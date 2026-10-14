# Velo — Deployment Guide

> Local setup and deployment configuration for the Velo backend and frontend.

## Local Development

### Prerequisites

| Service | Required | Install |
|---|---|---|
| Java 22 | Backend | `brew install openjdk@22` |
| PostgreSQL 16 + PostGIS | Backend | `brew install postgresql@16 postgis` |
| Redis | Optional location cache | `brew install redis` |
| Node.js 20+ | Frontend | `brew install node` |

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
# Landing: :4100, Admin: :4101, Requester: :4102, Driver: :4103
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

The backend test pool defaults to two connections. Keep the test application database and Flyway integration database separate. The Playwright E2E suite contains 20 tests.

### Docker Compose

`velo-platform/docker-compose.yml` starts PostGIS on port 5432 with the local app credentials and Redis on port 6379. On Apple Silicon, the PostGIS image is multi-architecture.

```bash
cd velo-platform
docker compose up -d
```

## Production Deployment

### Environment

Set `SPRING_PROFILES_ACTIVE=prod` and configure:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-endpoint>:5432/velo
SPRING_DATASOURCE_USERNAME=velo_app
SPRING_DATASOURCE_PASSWORD=<from-secrets-manager>
JWT_SECRET=<from-secrets-manager>
CORS_ALLOWED_ORIGINS=https://admin.example.com,https://rider.example.com
SPRING_DATA_REDIS_HOST=<elasticache-endpoint>
VELO_PROMETHEUS_ENABLED=false
```

The application uses `ddl-auto=validate`, disables SQL initialization, and applies Flyway migrations. Keep database credentials and `JWT_SECRET` in a secret manager. Enable Prometheus only when scraping is configured; its endpoint requires ADMIN authorization.

### AWS Reference Architecture

```text
Route 53 → CloudFront/S3 frontend
          → ALB → ECS Fargate → RDS PostgreSQL + PostGIS
                            └→ ElastiCache Redis
```

### CI/CD

- `frontend-quality.yml` — lint, typecheck, unit, contracts, and build
- `backend-quality.yml` — Maven regression suite
- `security.yml` — npm audit and OWASP dependency-check
- `integration-e2e.yml` — compose-based frontend/backend handshake
- `staging-deploy.yml` — requires a webhook URL, token, and admin/rider smoke URLs; the webhook must accept a bearer-authenticated repository/ref/SHA JSON request and return success after deployment completes. Missing configuration or failed deploy/smoke requests fail the job.
