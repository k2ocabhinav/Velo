# Frontend-Backend Integration Harness

This folder contains the compose-friendly handshake test used to validate the full browser-to-backend path.

## What it checks

- Backend health is reachable
- Admin login BFF proxies to the backend and returns a token
- Login sets the `velo_token` httpOnly cookie
- Protected admin pages redirect without a cookie and load with one
- The backend accepts the returned JWT on a protected admin endpoint

## Default credentials

- Email: `admin@velo-platform.com`
- Password: `password123`

These come from `velo-platform/src/main/resources/data.sql`.

## Run it

```bash
docker compose -f velo-frontend/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from smoke
```

The smoke service runs:

```bash
node velo-frontend/tests/integration/handshake.mjs
```
