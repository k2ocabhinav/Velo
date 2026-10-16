# Frontend-Backend Integration Harness

This folder contains the compose-friendly handshake test used to validate the full frontend-to-backend path across Admin, Rider, and Driver apps.

## What it checks

- Backend health is reachable
- OpenAPI exposure follows profile policy (local/dev open, non-local blocked)
- Admin login BFF + protected shell + proxy mutation path
- Admin dispatch endpoints + ops-health are reachable via admin proxy
- Rider login BFF + fare estimate + request ride + trip lane source endpoint
- Driver login BFF + profile + availability toggle path
- Auth cookie policy checks (`HttpOnly`, `SameSite=Lax`, `Secure`)

## Handshake modes

- `VELO_HANDSHAKE_MODE=mutate`:
  performs one deterministic admin dispatch mutation and writes an audit marker.
- `VELO_HANDSHAKE_MODE=verify-persisted`:
  verifies that the audit marker/state still exists after service restart.

## Default credentials

- Admin: `admin@velo-platform.com` / `password123`
- Rider: `henry@example.com` / `password123` (no pending or confirmed request)
- Driver: `bob.driver@example.com` / `password123` (approved, so availability can be toggled)
- Online driver: `carol.driver@example.com` / `password123` (taken online for assignment and booking)

These come from the local/dev Flyway demo seed at `velo-platform/src/main/resources/db/demo-migration/V2__seed_demo_data.sql`. `eve.driver@example.com` is the seeded PENDING applicant, so it cannot go online and is not used for the driver checks.

## Run it

```bash
docker compose --project-directory . -f velo-frontend/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from smoke
```

The published host ports (`5432`, `6379`, `8080`, `4101`–`4103`) can conflict with a running local stack; override them without editing the file, e.g. `VELO_E2E_POSTGRES_PORT=15432 VELO_E2E_REDIS_PORT=16379 docker compose …`.

The smoke service runs:

```bash
node velo-frontend/tests/integration/handshake.mjs
```
