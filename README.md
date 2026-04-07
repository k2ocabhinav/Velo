# Velo Platform

Backend for a white-label dispatch platform built with Spring Boot 3.3.1, Java 22, PostgreSQL/PostGIS, Redis-backed caching, JWT authentication, and OpenAPI documentation.

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

## Running Tests

```bash
cd velo-platform
./mvnw test
```

## Included Capabilities

- Rider, driver, auth, wallet, payment, rating, and ride lifecycle flows
- JWT-based login and stateless Spring Security
- Strategy-based fare calculation and driver matching
- PostGIS-backed geospatial queries for nearby driver selection
- OSRM distance integration for fare calculation
- Admin analytics, pending driver approval, and revenue reporting
- Actuator health indicators and Redis cache support
- Unit, strategy, service, and controller integration tests
