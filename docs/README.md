# Velo — Documentation Index

Single source of truth for the Velo project.

## Core

| Document | Purpose |
|---|---|
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | What Velo is, who it's for, and where it's going |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Codebase structure, patterns, conventions, database setup |
| [SWAGGER.md](SWAGGER.md) | API inventory — 60 endpoints across 8 groups |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local dev, Docker Compose, AWS production architecture |

## Frontend

| Document | Purpose |
|---|---|
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Visual language, theming architecture, animations, loading states, accessibility |
| [FRONTEND_PLAN.md](FRONTEND_PLAN.md) | Tech stack, monorepo structure, build phases, auth flow, WebSocket |

## How To Use

- **Starting fresh?** Read `PRODUCT_VISION.md` then `ARCHITECTURE.md`.
- **Building backend?** Read `ARCHITECTURE.md` for conventions, `SWAGGER.md` for API surface.
- **Building frontend?** Read `FRONTEND_PLAN.md`.
- **Deploying?** Read `DEPLOYMENT.md`.

## Current State (2026-04-07)

- Backend: 158 tests passing, BUILD SUCCESS
- Frontend: not yet started (plan in `FRONTEND_PLAN.md`)

## Implementation Status Update (2026-04-08)

- Frontend foundation is now implemented in `velo-frontend/` and merged into `main`.
- Admin app shell, auth BFF login route, protected-route middleware, and rider/driver starter shells are live.
- Shared frontend packages exist and are wired: `packages/api`, `packages/ui`, `packages/ws`, `packages/config`.
- CI quality and security workflows are in place:
  - `.github/workflows/frontend-quality.yml`
  - `.github/workflows/backend-quality.yml`
  - `.github/workflows/security.yml`
  - `.github/workflows/integration-e2e.yml`
- Integration harness exists at `velo-frontend/tests/integration/handshake.mjs`.

### Testing Status (2026-04-08)

- Layers currently available:
  - Frontend unit tests (Vitest)
  - API contract tests (Vitest)
  - Frontend E2E smoke (Playwright)
  - Frontend-backend integration handshake (Compose + Node script)
  - Backend unit/integration tests (Maven test suite)
  - Security checks (`npm audit`, OWASP dependency-check workflow)
- Passing in latest verified run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `./mvnw -q test`
- Phase 2 test gaps to close:
  - Rider feature-level unit tests (forms, validation, submit-state)
  - Rider E2E happy/failure flows
  - Expanded admin action E2E coverage

## Implementation Status Update (2026-04-08)

- Frontend foundation is now implemented in `velo-frontend` on `main`:
  - Admin shell pages, auth BFF login route, and protected-route middleware.
  - Rider and driver app shells with workspace-level build/lint/typecheck/test scripts.
  - Shared `packages/api`, `packages/ui`, `packages/ws`, and `packages/config`.
- Quality and delivery gates now exist in repository workflows:
  - `.github/workflows/frontend-quality.yml`
  - `.github/workflows/backend-quality.yml`
  - `.github/workflows/security.yml`
  - `.github/workflows/integration-e2e.yml`
- Frontend-backend compose handshake harness exists:
  - `velo-frontend/docker-compose.e2e.yml`
  - `velo-frontend/tests/integration/handshake.mjs`

### Testing Status (2026-04-08)

- Current layers in repo:
  - Unit: Vitest (`apps/admin`, `packages/api`, `packages/ws`)
  - API contract: Vitest (`packages/api/tests/contracts`)
  - E2E UI smoke: Playwright (`velo-frontend/tests/e2e`)
  - Frontend-backend integration: compose handshake script
  - Backend regression: Maven test suite
  - Security checks: npm audit + OWASP dependency-check workflow
- Passing baseline (latest run before this phase):
  - `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contracts`, `npm run build`
  - `./mvnw -q test`
- Phase 2 gaps to close:
  - Rider flow unit + e2e coverage.
  - Admin action-flow e2e coverage (approve/reject/process flows).
  - Broader integration scenarios beyond handshake (rider booking/request paths).

## Implementation Status Update (2026-04-08)

- Scope note: this is an append-only status record for current Phase 2 execution planning.
- Frontend baseline remains established in `velo-frontend/` with `admin`, `rider`, `driver`, and shared `packages/api`, `packages/ui`, `packages/ws`, `packages/config`.
- Admin and rider work in this phase is planned to move from scaffolded/static views to API-backed behavior.

### Testing Status (Unit/Contracts/E2E/Integration/Backend/Security)

- Current layers:
  - Unit: Vitest suites for frontend behavior and helpers.
  - Contracts: API client contract tests in `packages/api/tests/contracts`.
  - E2E: Playwright smoke coverage baseline.
  - Integration: compose handshake checks for frontend-backend auth/protected-route flow.
  - Backend: Maven regression suite.
  - Security: dependency/security workflow checks (`npm audit`, dependency-check).
- Passing now (latest baseline currently recorded in repo workflows):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `./mvnw -q test`
- Phase 2 gaps:
  - Rider feature unit coverage (auth/session, booking validation, scheduled flow validation).
  - Rider and admin action-path E2E expansion (happy path + failure path).
  - Integration scenarios beyond handshake (fare estimate, ride request, invalid payload handling).

## Implementation Status Update (2026-04-08, Phase 2 Build Progress)

- Admin Phase 2 pages are now API-backed for dashboard, drivers, users, payouts, promo codes, revenue, and scheduled rides.
- Rider Phase 2 pages are now API-backed for login/register, booking, rides, scheduled rides, wallet, promos, and notifications.
- Shared reliability/contract layers were expanded:
  - `packages/ws`: reconnect-safe subscription registry + typed notification/ride-update events.
  - `packages/api`: non-breaking method extensions + updated contract assertions.
- CI scaffolding now includes:
  - `frontend-quality.yml` with lint/typecheck/unit/contracts/build
  - `staging-deploy.yml` promotion gate scaffold
  - extended Playwright project wiring for rider smoke runs.

### Testing Status (2026-04-08, Phase 2 Build Progress)

- Current layers:
  - Unit: admin/rider/ws/api suites.
  - Contracts: `packages/api/tests/contracts`.
  - E2E: admin + rider smoke suites (Playwright).
  - Integration: compose handshake script expanded with rider backend flow checks.
  - Backend: Maven regression suite.
  - Security: `npm audit` + OWASP dependency-check workflow.
- Verified in this run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `npm run test:e2e -- --project=admin-chromium`
  - `PLAYWRIGHT_ENABLE_RIDER=true npm run test:e2e -- --project=rider-chromium`
  - `./mvnw -q test`
  - `npm audit --audit-level=high`
- Current CI/local caveat:
  - local compose integration run is blocked when Docker daemon is unavailable.
  - local `dependency-check:check` can fail on upstream NVD CVSS v4 parsing (`SAFETY` enum) until dependency-check/NVD parser update is available.

## Security Remediation Note (2026-04-08)

- Security remediation notes are tracked in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).
- `docs/` is tracked normally so future documentation updates should be committed alongside code changes.
