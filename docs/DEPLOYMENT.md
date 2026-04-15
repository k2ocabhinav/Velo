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
psql -U postgres -c "CREATE DATABASE postgres;"      # main (may already exist)
psql -U postgres -c "CREATE DATABASE testpostgres;"  # tests
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d testpostgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```
- User: `postgres`, Password: `user`
- DDL mode: `validate` (Flyway migrations manage schema changes)
- Seed data: `db/migration/V2__seed_demo_data.sql`

### Run Backend
```bash
cd velo-platform
# If needed in this shell:
# export JAVA_HOME=/Users/<you>/.sdkman/candidates/java/22.0.2-tem
./mvnw spring-boot:run
# API: http://localhost:8080
# Swagger: http://localhost:8080/swagger-ui/index.html
# OpenAPI spec: http://localhost:8080/v3/api-docs
```

Flyway migrations are applied at startup. Current expected local schema version includes:
- `V3__tenant_branding_and_isolation.sql`
- `V4__admin_dispatch_merchant_mode.sql`
- `V5__backfill_missing_driver_earnings.sql`

### Run Frontend
```bash
cd velo-frontend
npm install
npm run dev
# Landing: http://localhost:4100
# Admin: http://localhost:4101
# Requester: http://localhost:4102
# Driver: http://localhost:4103
```

### Run Tests
```bash
cd velo-platform
./mvnw test
./mvnw clean install   # Full build + tests

cd ../velo-frontend
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
# Optional:
# npx playwright install --with-deps
# npm run test:e2e
```

Current validation status (April 15, 2026):
- Backend Maven suite is green (`197` tests passing).
- Frontend unit + contract suites are green.
- Frontend Playwright e2e currently reports `17` failures and needs selector/flow refresh alongside active UI revamp work.

### Docker Compose (Optional)
For portable local dev without installing PostgreSQL/Redis natively. On Apple Silicon, prefer the repo's `docker/postgis` build to avoid running PostGIS images via amd64 emulation.

```yaml
# docker-compose.yml (place in project root)
services:
  postgres:
    build:
      context: ./docker/postgis
    image: velo/postgis:16
    environment:
      POSTGRES_PASSWORD: user
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  testdb:
    build:
      context: ./docker/postgis
    image: velo/postgis:16
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

## Production Deployment

### Option A: Budget ($5-10/mo) — Railway or Render

Best for: early development, demos, testing with real users.

```
[Vercel]              [Railway]
 Frontend (free)  -->  Spring Boot ($5/mo)
                       PostgreSQL (included)
                       Redis (included)
```

**Steps:**
1. Push `velo-frontend/` to GitHub -> connect to Vercel -> auto-deploys
2. Push `velo-platform/` to GitHub -> connect to Railway
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
  --> CloudFront (CDN) --> S3 (frontend static files)
  --> ALB --> ECS Fargate (Spring Boot, 2 tasks)
                |--> RDS PostgreSQL (t4g.micro, PostGIS)
                `--> ElastiCache Redis (t4g.micro)
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

#### Dockerfile for Spring Boot
```dockerfile
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

**Critical:** `ddl-auto` must be `validate` in production. Use Flyway or Liquibase for schema migrations.

## Environment Comparison

| Setting | Local | Production |
|---|---|---|
| `ddl-auto` | `validate` | `validate` |
| `sql.init.mode` | `never` | `never` |
| Flyway migrations | Runs | Runs |
| Database | localhost:5432 | RDS endpoint |
| Redis | localhost:6379 | ElastiCache |
| CORS origins | `http://localhost:*` | `https://*.velo.app` |
| JWT expiry | 24h (fine for dev) | 24h (add refresh tokens later) |

## Scaling Notes
- ECS Fargate tasks can auto-scale based on CPU/memory
- RDS can scale vertically (t4g.micro -> t4g.small -> t4g.medium)
- For multi-tenancy: consider RDS per-tenant or schema-per-tenant
- WebSocket: ALB supports sticky sessions for STOMP; at scale, use Redis pub/sub for cross-instance delivery

## CI/CD Workflows
- `frontend-quality.yml` — lint, typecheck, unit, contracts, build
- `backend-quality.yml` — Maven regression tests
- `security.yml` — npm audit + OWASP dependency-check
- `integration-e2e.yml` — compose-based frontend-backend handshake
- `staging-deploy.yml` — staging gate scaffold (placeholder)
- Integration harness: `velo-frontend/docker-compose.e2e.yml` + `tests/integration/handshake.mjs`
- Security remediation tracking: see `SECURITY_REMEDIATION.md`
