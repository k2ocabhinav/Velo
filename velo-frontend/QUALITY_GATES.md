# Velo Frontend Quality Gates

This is the reusable baseline for frontend and backend validation. The goal is to keep it simple enough for people and agents to run repeatedly without guesswork.

## Local Checks

Frontend:

```bash
cd velo-frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

Backend:

```bash
cd velo-platform
./mvnw -q test
./mvnw -q dependency-check:check
```

Integration:

```bash
docker compose --project-directory . -f velo-frontend/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from smoke
```

## CI Coverage

- `frontend-quality.yml`: frontend lint/typecheck/build
- `backend-quality.yml`: backend test suite
- `security.yml`: frontend npm audit + backend OWASP dependency check
- `integration-e2e.yml`: compose-based frontend-backend handshake

## Security Policy

- Block merges on high or critical dependency findings where the tool supports it
- Keep all auth cookies httpOnly and same-site
- Treat redirect targets as untrusted input unless explicitly sanitized

## Reuse Notes

- Keep the integration harness pointed at seeded admin credentials for deterministic smoke checks
- Add new API contract tests whenever a backend controller changes request shape, return shape, or path
- Update the compose file before adding any new cross-service dependency to the frontend
