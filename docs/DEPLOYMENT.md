# Velo — Deployment Guide

> How to run Velo locally and deploy to production.

## Local Development

### Prerequisites
| Service | Required | Install |
|---|---|---|
| Java 22 | Yes | `brew install openjdk@22` |
| PostgreSQL 16 + PostGIS | Yes | `brew install postgresql@16 postgis` |
| Redis | Optional (driver location cache) | `brew install redis` |
| Node.js 20+ | For frontend | `brew install node` |

### Database Setup
```bash
# Create databases
psql -U postgres -c "CREATE DATABASE postgres;"      # main (may already exist)
psql -U postgres -c "CREATE DATABASE testpostgres;"  # tests
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d testpostgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```
- User: `postgres`, Password: `user`
- DDL mode: `create-drop` (schema auto-created on boot)
- `data.sql` seeds sample data on startup

### Run Backend
```bash
cd velo-platform
./mvnw spring-boot:run
# API: http://localhost:8080
# Swagger: http://localhost:8080/swagger-ui/index.html
# OpenAPI spec: http://localhost:8080/v3/api-docs
```

### Run Frontend (after Phase 1)
```bash
cd velo-frontend
npm install
npm run dev
# Admin: http://localhost:3000
# Rider: http://localhost:3001 (Phase 2)
# Driver: http://localhost:3002 (Phase 3)
```

### Run Tests
```bash
cd velo-platform
./mvnw test            # All 158 tests
./mvnw clean install   # Full build + tests
```

### Docker Compose (Optional)
For portable local dev without installing PostgreSQL/Redis natively:

```yaml
# docker-compose.yml (place in project root)
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_PASSWORD: user
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  testdb:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_PASSWORD: user
      POSTGRES_DB: testpostgres
    ports:
      - "5433:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

```bash
docker compose up -d
# Then run backend normally: ./mvnw spring-boot:run
```

---

## Production Deployment

### Option A: Budget ($5-10/mo) — Railway or Render

Best for: early development, demos, testing with real users.

```
[Vercel]              [Railway]
 Frontend (free)  ──▶  Spring Boot ($5/mo)
                       PostgreSQL (included)
                       Redis (included)
```

**Steps:**
1. Push `velo-frontend/` to GitHub → connect to Vercel → auto-deploys
2. Push `velo-platform/` to GitHub → connect to Railway
3. Railway provisions PostgreSQL + Redis automatically
4. Set environment variables in Railway:
   - `SPRING_DATASOURCE_URL` (Railway provides this)
   - `SPRING_REDIS_HOST`
   - `JWT_SECRET_KEY` (generate a secure random string)
5. Frontend `NEXT_PUBLIC_API_URL` points to Railway backend URL

### Option B: AWS ($45-65/mo) — Production Ready

Best for: real users, multi-tenant future, scaling.

#### Architecture
```
Route 53 (DNS)
  └─▶ CloudFront (CDN) ──▶ S3 (frontend static files)
  └─▶ ALB ──▶ ECS Fargate (Spring Boot, 2 tasks)
                ├──▶ RDS PostgreSQL (t4g.micro, PostGIS)
                └──▶ ElastiCache Redis (t4g.micro)
```

#### AWS Services

| Component | Service | Spec | Cost/mo |
|---|---|---|---|
| Backend | ECS Fargate | 0.5 vCPU, 1GB RAM, 2 tasks | ~$15-30 |
| Database | RDS PostgreSQL | t4g.micro, 20GB, PostGIS | ~$15 |
| Cache | ElastiCache Redis | t4g.micro | ~$12 |
| Frontend | S3 + CloudFront | Static hosting + CDN | ~$1-5 |
| DNS | Route 53 | 1 hosted zone | ~$0.50 |
| SSL | ACM | *.velo.app | Free |
| Secrets | Secrets Manager | JWT key, DB password | ~$1 |
| Logging | CloudWatch | Basic | ~$2-5 |

#### Deployment Steps

**1. Backend (ECS Fargate)**
```bash
# Build Docker image
cd velo-platform
./mvnw clean package -DskipTests
docker build -t velo-platform .

# Push to ECR
aws ecr create-repository --repository-name velo-platform
docker tag velo-platform:latest <account>.dkr.ecr.<region>.amazonaws.com/velo-platform
docker push <account>.dkr.ecr.<region>.amazonaws.com/velo-platform

# Create ECS service via AWS console or Terraform
# - Task definition: image from ECR, 0.5 vCPU, 1GB
# - Service: 2 desired tasks behind ALB
# - Environment variables from Secrets Manager
```

**2. Database (RDS)**
```bash
# Create via AWS console or CLI
aws rds create-db-instance \
  --db-instance-identifier velo-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password <secure-password> \
  --allocated-storage 20

# Enable PostGIS after creation:
# Connect to RDS and run: CREATE EXTENSION postgis;
```

**3. Frontend (S3 + CloudFront)**
```bash
cd velo-frontend
npm run build

# Upload to S3
aws s3 sync apps/admin/out s3://velo-admin-frontend/
aws s3 sync apps/rider/out s3://velo-rider-frontend/

# CloudFront distribution points to S3 bucket
# Configure custom domain via Route 53
```

**4. Required Dockerfile for Spring Boot**
```dockerfile
# velo-platform/Dockerfile
FROM eclipse-temurin:22-jre-alpine
WORKDIR /app
COPY target/velo-platform-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Environment Variables (Production)
```
SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-endpoint>:5432/velo
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<from-secrets-manager>
SPRING_JPA_HIBERNATE_DDL_AUTO=validate    # NOT create-drop in prod!
SPRING_SQL_INIT_MODE=never                # Don't run data.sql in prod
SPRING_DATA_REDIS_HOST=<elasticache-endpoint>
JWT_SECRET_KEY=<from-secrets-manager>
```

**Critical production change:** `ddl-auto` must be `validate` (not `create-drop`). Use Flyway or Liquibase for schema migrations before going to production.

---

## Environment Comparison

| Setting | Local | Production |
|---|---|---|
| `ddl-auto` | `create-drop` | `validate` |
| `sql.init.mode` | `always` | `never` |
| `data.sql` | Runs (seeds data) | Skipped |
| Database | localhost:5432 | RDS endpoint |
| Redis | localhost:6379 | ElastiCache |
| CORS origins | `http://localhost:*` | `https://*.velo.app` |
| JWT expiry | 24h (fine for dev) | 24h (add refresh tokens later) |

## Scaling Notes
- ECS Fargate tasks can auto-scale based on CPU/memory
- RDS can scale vertically (t4g.micro → t4g.small → t4g.medium)
- For multi-tenancy (Phase 2 of product vision): consider RDS per-tenant or schema-per-tenant
- WebSocket connections: ALB supports sticky sessions for STOMP; at scale, consider a dedicated WebSocket service or use Redis pub/sub for cross-instance notification delivery

## Implementation Status Update (2026-04-08)

### Deployment and CI Baseline Added
- Frontend quality workflow is active for lint/typecheck/build.
- Backend quality workflow is active for Maven tests.
- Security workflow is active for frontend audit + backend dependency check.
- Integration workflow is active for compose-based frontend-backend handshake.

### Local Integration Harness Added
- Compose harness is available at `velo-frontend/docker-compose.e2e.yml`.
- Smoke checks are scripted in `velo-frontend/tests/integration/handshake.mjs`.
- Harness validates:
  - backend reachability/openapi
  - login BFF response/cookie behavior
  - protected-route redirect and authenticated load
  - backend protected endpoint acceptance with JWT.

### Testing and Verification Status (2026-04-08)
- Current layers available in delivery pipeline:
  - frontend lint/typecheck/build
  - frontend unit and contract tests
  - backend regression tests
  - dependency/security checks
  - integration handshake checks
- Known current local caveat:
  - if Redis is not running locally, `/actuator/health` may report degraded while core API/UI flows still run.
- Phase 2 deployment/testing gaps:
  - staging promotion workflow with explicit environment gates
  - rider end-to-end flows in Playwright and integration harness

## Implementation Status Update (2026-04-08)

### Current Delivery Baseline
- Frontend monorepo is now active and runnable (`admin`, `rider`, `driver`).
- CI workflows now cover:
  - frontend quality (`.github/workflows/frontend-quality.yml`)
  - backend quality (`.github/workflows/backend-quality.yml`)
  - security checks (`.github/workflows/security.yml`)
  - frontend-backend integration handshake (`.github/workflows/integration-e2e.yml`)
- Integration compose harness exists at `velo-frontend/docker-compose.e2e.yml`.

### Testing/Verification Status (2026-04-08)
- Available layers:
  - frontend unit + typecheck + lint + build
  - frontend API contract tests
  - Playwright smoke
  - compose-based integration handshake
  - backend regression tests
  - dependency/security scans
- Current passing baseline used for scaffolding merge:
  - `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contracts`, `npm run build`
  - `./mvnw -q test`

### Phase 2 Deployment & Test Gaps
- Add staging deployment workflow scaffold with environment placeholders and promotion gates.
- Expand e2e from shell smoke to admin action and rider booking/session scenarios.
- Expand integration checks to include rider booking request paths in addition to admin handshake.

### Local Caveat
- `actuator/health` may report degraded status when Redis is unavailable locally while core API/UI flows still run; CI integration remains the primary gate.

## Implementation Status Update (2026-04-08)

### Delivery and Environment State
- Frontend and backend quality/security/integration workflows are available as non-optional quality gates for this phase.
- Compose-based integration remains the cross-stack validation baseline where local environment parity is available.
- Staging promotion gates are planned to be expanded as Rider/Admin live wiring lands.

### Testing Status (Unit/Contracts/E2E/Integration/Backend/Security)
- Current layers:
  - Unit: frontend Vitest suites.
  - Contracts: frontend API contract tests.
  - E2E: Playwright smoke baseline.
  - Integration: compose handshake scripts for auth/protected flow checks.
  - Backend: Maven regression tests.
  - Security: dependency and vulnerability scans in CI.
- Passing now (current baseline from latest recorded runs):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `./mvnw -q test`
- Phase 2 gaps:
  - Expand E2E to rider booking/scheduled and admin action-path scenarios.
  - Expand integration harness beyond handshake into rider fare-estimate and ride-request validations.
  - Add explicit staging promotion checks tied to required workflow status.

## Implementation Status Update (2026-04-08, Phase 2 Deployment/Test Progress)

### Delivery pipeline updates
- Frontend quality pipeline now enforces:
  - `lint`
  - `typecheck`
  - `test:unit`
  - `test:contracts`
  - `build`.
- Integration workflow and local harness now include expanded rider backend validation in handshake logic.
- Staging gate scaffold exists at `.github/workflows/staging-deploy.yml` with:
  - quality prerequisite stage
  - staging deployment placeholders
  - staging smoke placeholders
  - manual promotion gate placeholder.

### Testing Status (2026-04-08, Phase 2 Deployment/Test Progress)
- Verified in this run:
  - frontend: lint/typecheck/unit/contracts/build
  - Playwright admin smoke
  - Playwright rider smoke (enabled path)
  - backend Maven tests
  - frontend npm audit.
- Integration feasibility note:
  - compose integration remains supported in CI; local run requires Docker daemon availability.
- Security gate caveat:
  - local execution of `dependency-check:check` may fail during NVD update due CVSS v4 parser mismatch (`SAFETY` enum) until upstream dependency-check parser data compatibility is updated.
