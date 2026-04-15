# Velo Platform

Backend for a white-label dispatch platform built with Spring Boot 3.5.13, Java 22, PostgreSQL/PostGIS, Redis-backed caching, JWT authentication, and OpenAPI documentation.

## Project Layout

- `velo-platform/` - Maven project root and application source
- `docs/` - internal planning and project history

## Prerequisites

- Java 22
- PostgreSQL with PostGIS available
- Local runtime database: `postgres`
- Local test database: `testpostgres`
- Database user: `postgres`
- Database password: `user`
- Optional Redis instance on `localhost:6379`

The application and tests attempt `CREATE EXTENSION IF NOT EXISTS postgis` on startup. If the database user cannot create extensions, install PostGIS ahead of time.

## Local Setup

1. Start PostgreSQL and ensure both `postgres` and `testpostgres` exist.
2. Optionally start Redis:

```bash
cd velo-platform
docker compose up -d redis
```

3. Build or run the application:

```bash
cd velo-platform
./mvnw clean install
./mvnw spring-boot:run
```

4. Open the API docs:
   - `http://localhost:8080/swagger-ui/index.html`
   - `http://localhost:8080/swagger-ui.html`

## Frontend Port Map

- Landing portal: `http://localhost:4100`
- Admin portal: `http://localhost:4101`
- Requester portal: `http://localhost:4102`
- Driver portal: `http://localhost:4103`

## Running Tests

Backend:

```bash
cd velo-platform
./mvnw test
```

Frontend:

```bash
cd velo-frontend
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
```

Optional E2E:

```bash
cd velo-frontend
npx playwright install --with-deps
npm run test:e2e
```

Validation snapshot (April 15, 2026):
- `velo-platform`: `./mvnw test` -> passing (`197` tests, `0` failures/errors).
- `velo-frontend`: `npm run test:unit` + `npm run test:contracts` -> passing.
- `velo-frontend`: `npm run test` currently fails in Playwright e2e (`17` failures) while UI flows/selectors are being revamped.

## Latest Reliability Updates (April 15, 2026)

- Enforced full constructor dependency injection for critical services (`RiderServiceImpl`, `DriverServiceImpl`, `FareEstimationServiceImpl`) so runtime does not silently execute degraded `null` dependency paths.
- Kept ride acceptance race-safe through DB compare-and-set as the single claim path.
- Made driver earnings settlement idempotent per ride to prevent duplicates under concurrent end-trip calls.
- Added Flyway migration `V5__backfill_missing_driver_earnings.sql` to restore missing earnings entries for already completed rides.
- Maintained tenant-scoped rider/driver resolution (`findByUserIdAndTenantId`) for isolation-safe identity lookups.

## Included Capabilities

- Rider, driver, auth, wallet, payment, rating, and ride lifecycle flows
- JWT-based login and stateless Spring Security
- Strategy-based fare calculation and driver matching
- PostGIS-backed geospatial queries for nearby driver selection
- OSRM distance integration for fare calculation
- Admin analytics, pending driver approval, and revenue reporting
- Actuator health indicators and Redis cache support
- Unit, strategy, service, and controller integration tests
