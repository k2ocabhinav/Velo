# Frontend-Backend Integration Harness

This folder contains the compose-friendly handshake test used to validate the full frontend-to-backend path across Admin, Rider, and Driver apps.

## What it checks

- Backend health is reachable
- OpenAPI exposure follows profile policy (local/dev open, non-local blocked)
- Admin login BFF + protected shell + proxy mutation path
- Rider login BFF + fare estimate + request ride + trip lane source endpoint
- Driver login BFF + profile + availability toggle path
- Auth cookie policy checks (`HttpOnly`, `SameSite=Lax`, `Secure`)

## Default credentials

- Admin: `admin@velo-platform.com` / `password123`
- Rider: `alice@example.com` / `password123`
- Driver: `eve.driver@example.com` / `password123`

These come from `velo-platform/src/main/resources/data.sql`.

## Run it

```bash
docker compose --project-directory . -f velo-frontend/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from smoke
```

The smoke service runs:

```bash
node velo-frontend/tests/integration/handshake.mjs
```
