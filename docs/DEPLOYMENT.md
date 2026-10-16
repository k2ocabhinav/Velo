# Velo — Deployment Guide

> Local setup and deployment configuration for the Velo backend and frontend.

## Local Development

### Prerequisites

| Service | Required | Install |
|---|---|---|
| Java 21+ | Backend | `brew install openjdk@21` |
| PostgreSQL 16 + PostGIS | Backend | `brew install postgresql@16 postgis` |
| Redis | Optional location cache | `brew install redis` |
| Node.js 22+ | Frontend | `brew install node` |

### Database Setup

The local app connects to database `postgres`; tests use `testpostgres`. The Flyway integration test cleans schemas in its own `testpostgres_flyway` database.

```bash
createdb -U postgres testpostgres
createdb -U postgres testpostgres_flyway
psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d testpostgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d testpostgres_flyway -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Local PostgreSQL credentials are `postgres` / `user`. Flyway owns the schema. Local and dev profiles also run the demo seed from `db/demo-migration/`.

### Profiles and Configuration

`local` is the default profile. The other runtime profiles are `dev`, `staging`, and `prod`; the `test` profile is defined under test resources.

| Variable | Purpose |
|---|---|
| `SPRING_PROFILES_ACTIVE` | Select `local`, `dev`, `staging`, or `prod` |
| `SPRING_DATASOURCE_URL` | JDBC URL for dev, staging, or production |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Database credentials |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact browser origins |
| `VELO_PROMETHEUS_ENABLED` | Set to `true` to enable `/actuator/prometheus` |

Non-local profiles require explicit database credentials, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS`. Prometheus metrics require `VELO_PROMETHEUS_ENABLED=true` and an ADMIN bearer token. `/actuator/health` remains public.

### Run the Applications

```bash
cd velo-platform
./mvnw spring-boot:run
# API: http://localhost:8080
# Swagger UI: http://localhost:8080/swagger-ui/index.html

cd ../velo-frontend
npm install
npm run dev
# Landing: :4100, Admin: :4101, Rider: :4102, Driver: :4103
```

### Run Tests

```bash
cd velo-platform
./mvnw clean test

cd ../velo-frontend
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
npm run test:e2e
```

The backend test pool defaults to two connections. Keep the test application database and Flyway integration database separate. The Playwright E2E suite covers the admin, rider and driver apps.

### Docker Compose

`velo-platform/docker-compose.yml` starts PostGIS on port 5432 with the local app credentials and Redis on port 6379. On Apple Silicon, the PostGIS image is multi-architecture.

```bash
cd velo-platform
docker compose up -d
```

## Production Deployment

### Runtime configuration

Set `SPRING_PROFILES_ACTIVE=prod` (or `staging`) and provide these values to the backend. The ECS task reads secret values from Secrets Manager.

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-endpoint>:5432/velo
SPRING_DATASOURCE_USERNAME=velo_app
SPRING_DATASOURCE_PASSWORD=<from-secrets-manager>
SPRING_DATA_REDIS_HOST=<elasticache-endpoint>
SPRING_DATA_REDIS_PORT=6379
JWT_SECRET=<from-secrets-manager>
SPRING_PROFILES_ACTIVE=prod
CORS_ALLOWED_ORIGINS=https://admin.example.com,https://rider.example.com
VELO_PROMETHEUS_ENABLED=false
```

Prod and staging use `ddl-auto=validate`, disable SQL logging and SQL initialization, require an explicit Redis host, and apply only schema Flyway migrations. Redis uses TLS. Liveness and readiness probes are enabled for local, staging, and prod. `/actuator/health/readiness` checks readiness state, PostgreSQL, and disk space without depending on Redis; Docker uses this group. The aggregate `/actuator/health` remains public for status checks, while component details, including Redis, are visible to ADMIN. Prometheus requires an ADMIN token.

Requests with `X-Forwarded-Proto=http` are denied. The ALB redirects port 80 to HTTPS and forwards the HTTPS scheme; prod/staging trust forwarded headers and return HSTS for HTTPS requests. The BFF login cookies are httpOnly and production always sets `Secure`.

### Container images

Build the backend image from the backend directory. The image compiles with Maven's dependency cache and runs on a non-root Java 21 JRE image:

```sh
cd velo-platform
docker build -t velo-backend:<tag> .
```

Build one standalone Next.js image per app from the monorepo root. `APP` must be `admin`, `rider`, `driver`, or `landing`; set the public API URL at build time because Next.js bundles `NEXT_PUBLIC_*` values into browser code.

```sh
cd velo-frontend
docker build --build-arg APP=admin --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com -t velo-admin:<tag> .
```

Repeat for the other three app names. Runtime BFF requests use `VELO_API_BASE_URL`; set `VELO_AUTH_COOKIE_SECURE=true` in production. Each frontend image runs the existing `start-standalone.mjs` asset-sync startup.

To build all five images and run a local container smoke check, use:

```sh
scripts/docker-smoke.sh
```

The script requires Docker, `curl`, and local PostgreSQL tools. It recreates only the dedicated `velo_docker_smoke` database on `localhost:5432`, enables PostGIS, builds the backend plus admin, rider, driver, and landing images, then starts the backend with the `local` profile and the admin image. The staging profile cannot use the default local PostgreSQL credentials: backend security rejects the `postgres` username or `user` password outside local/test profiles. The backend connects to the host database through `host.docker.internal`; the script checks `/actuator/health/readiness` and that admin `/login` returns HTTP 200. It prints local image sizes, removes only the containers it starts, and keeps the images and smoke database. Set `VELO_DOCKER_SMOKE_PGHOST`, `VELO_DOCKER_SMOKE_PGPORT`, `VELO_DOCKER_SMOKE_PGUSER`, or `VELO_DOCKER_SMOKE_PGPASSWORD` to use different local database connection settings. `VELO_DOCKER_SMOKE_TAG` changes the image tag.

The local profile can start without Redis and use its fallback paths. If no Redis server is reachable, the aggregate `/actuator/health` can report Redis as down, visible in its component details to ADMIN. Readiness and the backend Docker healthcheck remain healthy when PostgreSQL and disk space are healthy.

### AWS deployment

The reference topology has two AZs, a public ALB, private ECS Fargate tasks, private RDS PostgreSQL with PostGIS, and ElastiCache Redis:

```text
Route 53 → ALB HTTPS → ECS Fargate: backend + four Next.js standalone apps
                        ├→ RDS PostgreSQL + PostGIS
                        └→ ElastiCache Redis
```

The Next.js apps need server rendering and BFF routes, so they run as ECS services rather than static S3 sites. Terraform in `infra/terraform` creates networking, the cluster and services, ECR repositories, load-balancer host routing, data stores, and secret references. Read its README for prerequisites, the ECR-first bootstrap, image publishing, and plan/apply commands. Supply an ACM certificate ARN, API and frontend domains, JWT secret, allowed origins, and a supported PostgreSQL 16 version. Add DNS records for all five hostnames to the ALB.

Terraform manages JWT/CORS secret values, which therefore appear in Terraform state. Use encrypted, locked remote state with restricted access. RDS deletion protection is on. This work defines infrastructure only; an operator must supply AWS access, certificate, DNS, and secret values and run Terraform.

ECS reads database credentials at task startup. The Terraform configuration disables automatic RDS master-password rotation; rotate credentials during planned maintenance and force a backend service deployment so tasks receive the new value.

### CI/CD

- `frontend-quality.yml` — lint, typecheck, unit, contracts, and build
- `backend-quality.yml` — Maven regression suite
- `security.yml` — npm audit and OWASP dependency-check
- `integration-e2e.yml` — compose-based frontend/backend handshake
- `staging-deploy.yml` — requires a webhook URL, token, and admin/rider smoke URLs; the webhook must accept a bearer-authenticated repository/ref/SHA JSON request and return success after deployment completes. Missing configuration or failed deploy/smoke requests fail the job.
