# Velo — Progress Tracker

> Shared checklist of what is done and what is not. One line per item.

## How To Use
- `[x]` = done, `[ ]` = not done.
- When you finish an item, flip it to `[x]` and add a short commit hash.
- New work goes in the right section as `[ ]`.
- Open work lives under **Now / Next**; the sections below record what is complete.
- When a section is fully done, collapse it to a single `[x]` summary line and delete the detail — git keeps the history.
- Never append dated status updates or snapshots; edit this file in place.
- Record decisions in `docs/decisions/`, not here.
- Keep every item to one line.

---

## Now / Next

### CI fix round 2026-10-16 (main runs 38923264472, 38923264449)
- [x] demo-sim fake clock yields to a macrotask like the real clock (the fleet-reset test spun an unbounded microtask chain and was bound by wall-clock speed); the 20 s vitest override is no longer needed — `packages/demo-sim/tests/helpers.ts`, `stomp-session.test.ts`, `vitest.config.mts`
- [x] E2E gates: review captures use a repo-relative path, axe audits wait for entrance-motion opacity to settle, live fleet panel/skeletons/status pill carry explicit ARIA roles
- [x] Handshake: the JWT stays in the httpOnly cookie (not the login body), an approved seeded driver goes online for assignment and booking, driver-app checks run as an approved seed, and demo fixture repair is switchable (`app.demo.fixture-refresh-enabled`) for the restart pass

### Critical fixes (found in the 2026-10-14 code review)
- [x] Lock down `/auth/onBoardNewDriver/{userId}`: currently public and grants DRIVER to any user (9ceda0f)
- [x] Drop the `payment.user_id` UNIQUE constraint and make `Payment.user` `@ManyToOne` (a rider's second paid ride fails) (37d3ebb)
- [x] Stop serializing password hashes in `GET /admin/users` (return a DTO) (37d3ebb)
- [x] Stop logging password-reset tokens (`AuthServiceImpl`) (9ceda0f)
- [x] Prod must not inherit the dev `jwt.secret` or DB credentials: source them from the environment and fail fast if unset (9ceda0f)

### Review-fix round 2026-10-14 (merged)
- [x] Auth/secrets hardening: onboarding ownership, JWT filter scope, generic auth errors, env-sourced secrets with fail-fast, demo seed local-only, actuator/CORS/WS origins per profile (9ceda0f)
- [x] Payments/tenancy: per-ride payments (V6), admin user DTO, tenant-scoped admin/payout/promo/scheduled paths, atomic payouts and promo usage, SecureRandom OTP, per-ride dispatch transactions, generic 500s, input validation (37d3ebb)
- [x] Admin dispatch N+1 removed, base fare applied, `startRide` path naming (6195de3)
- [x] JWT kept out of browser code (WS tickets via BFF), security headers on all apps, driver `/register` reachable (decision 0016)
- [x] Rider pending-request recovery + duplicate guard, stale earnings guard, dispatch form kept on failure, maps fit once + follow toggle, reduced motion, skeletons on admin users/payouts and driver earnings (decision 0017)
- [x] npm audit: 20 vulnerabilities → 0
- [x] Test infra safe by default (small pool, dedicated Flyway DB), concurrent dispatch race test, PostGIS in local compose, staging deploy fails on missing config, Prometheus metrics behind ADMIN, docs drift fixed (47437d1)
- [x] Backend suite: 0 failures (an earlier over-count was corrected in this round)

### Follow-ups found during the 2026-10-14 rounds
- [x] EP-1 Rider wallet balance/transactions endpoint + admin revenue per driver
- [x] EP-2 Geocoding proxy (decision 0021) + search-on-submit address search + rider saved places (V9)
- [x] EP-3 Refresh-token cleanup + grace window (decision 0022); tenant brand in wordmarks
- [x] EP-4 Docker images build (backend 143 MiB, frontends ~72 MiB), readiness without Redis, scripts/docker-smoke.sh
- [x] EP-5 Demo readiness: second branded tenant (Saffron Routes), `scripts/demo-up.sh`, README with screenshots, `docs/DEMO_SCRIPT.md`
- [x] EP-6 Recurring trip templates (V10), trip sheet + CSV, unassigned alerts, reason codes (decision 0023)
- [x] Landing page: researched redesign 'Livery' (light-first, paper/ink/livery green, cartographic 3D hero, day/night), 4 critique rounds; gates green (axe 0, 123 kB first load)
- [x] E2E determinism: mock API for server-side branding; all green across 3 consecutive runs plus the orchestrator CI run
- [x] Landing polish: debug-looking labels removed; README screenshots refreshed (day + night) (small fleets, pre-booked transfers), pricing hypothesis, contact form; Netlify-free-tier deployable
- [x] Demo rehearsal fixes: per-host tenant branding, production demo stack, fresh fixture reset, ride request mapping, tenant currency (V11), form-post login with same-origin check, realistic fares/wallets, offer addresses and expiry (V12)
- [x] Live fleet map on admin Dispatch (`GET /admin/dispatch/live`, decision 0024)
- [x] Demo fleet simulator (`packages/demo-sim`, simulated accounts, matching isolation incl. manual assignment, V13, live controls panel + `scripts/demo-sim.sh`; decision 0024)
- [x] Rider live trip updates delivered over WebSocket (principal fix, decision 0025)
- [x] Demo polish: single request countdown, driver name on profile, operator-style audit seed text, rounded distance, plurals; demo seed fixtures repaired
- [x] Per-tenant tariffs and service areas (V14, decision 0026); offline font builds; compact driver offer card; demo rehearsals #6/#7 demo-ready
- [x] Full functional audit of every existing feature (rider, driver, admin, API, first-run, landing, simulator) with fixes: driver self-registration and approval gating, pending-request cancel, payout lifecycle, admin route protection, tenant-aware signup, tenant time zones and UTC backend (decisions 0028, 0030), rated flags, rejection reasons, accurate 4xx codes, atomic payouts, notification currency/time/labels, after-commit realtime delivery; CI green on GitHub incl. backend tests under UTC and Asia/Kolkata (verified 2026-10-17)

### Tenant commercial settings (V14)
- [x] Per-tenant fare tariffs and geocoder service areas; Saffron demo money fixtures follow INR rates (decision 0026)

### After program acceptance (parked; depth features)
- Corporate accounts + contract tariffs + monthly statements; driver/vehicle document readiness + incidents; DPDP features (consent, export/deletion, retention); PWA + web push; OSRM road-based ETA dispatch; Hindi localization
- [ ] Apply Terraform — deferred: no AWS account or budget; demos run locally (see research for $0 options)

### UI/UX improvement round (merged; e2e green)
- [x] Plan written: `docs/UX_REFINEMENT_PLAN.md`
- [x] UI-0 shared foundation (styles, components, formatters, RouteStrip)
- [x] UI-1 admin pages
- [x] UI-2 rider pages
- [x] UI-3 driver pages
- [x] UI-4a auth screens (AuthLayout) and landing reduced-motion
- [x] UI-4b polish: rider Book banner shows completed trips as underway; Follow-driver control styling
- [x] UI-4c WCAG 2.1 AA pass (axe in e2e)

### Security & production readiness (highest priority)
- [x] HTTPS enforcement config for production (forwarded proto + HSTS)
- [x] Rate limiting on auth endpoints (Redis + in-memory fallback)
- [x] Dependency-check NVD CVSS v4 parser fix — bumped to 12.2.1 (verify on next CI run with NVD key)
- [x] Refresh token mechanism — rotating, hashed, family revocation (decision 0018)
- [x] Production Dockerfiles (backend + Next standalone)
- [x] Production `application-prod.properties` (`ddl-auto=validate`)
- [x] Secrets Manager wiring in Terraform (apply pending: needs AWS account)
- [x] RDS PostgreSQL/PostGIS in Terraform (apply pending)
- [x] ECS Fargate services/task definitions in Terraform (apply pending)
- [ ] Frontend hosting: Terraform runs the Next apps on ECS (SSR/BFF need a server); S3+CloudFront not used — revisit for static assets/CDN

### Backend
- [x] Auth endpoint integration tests (profile, password reset, refresh, logout, rate limits)

### Frontend — reliability & UX
- [x] `packages/ws`: exponential backoff reconnection strategy
- [x] `packages/ws`: visual "Reconnecting..." indicator component
- [x] `packages/ui`: skeleton variants (DataTable/StatCard/Section `.Skeleton`)
- [x] Rider: real-time ride tracking (WebSocket + map) — already implemented on `/ride/active`
- [x] Rider: "Finding driver" animation/loading state (verified in code 2026-10-15)
- [x] Admin: loading skeletons for all data pages (users and payouts done) (verified in code 2026-10-15)
- [x] Admin: error states with retry for all API-backed pages (verified in code 2026-10-15)
- [x] Loading/skeleton states for every data component (verified in code 2026-10-15)

### Frontend — testing
- [x] Admin action E2E tests (approve/reject/process flows)
- [x] Rider booking E2E tests

### Accessibility & theming
- [x] Multi-tenant theme loading (decision 0020)
- [x] WCAG 2.1 AA: axe checks in e2e, 0 serious/critical

---

## Backend (velo-platform/)

### Core
- [x] Complete — ride lifecycle, matching/fare/payment strategies, promo engine, scheduled dispatch, WebSocket notifications, earnings + payouts, admin panel, JWT auth with roles, profile/password-reset/availability/payment-methods APIs, CORS. See `ARCHITECTURE.md`.

### Security & hardening
- [x] Scoped auth endpoints, correct Spring `@Transactional` import, reset token not leaked in response, profile-gated Swagger/OpenAPI exposure — `91cbc5c`
- [x] OWASP dependency-check baseline driven to 0 CVEs — `91cbc5c`, `605b0e1`
- [x] Tenant-scoped identity lookups (`findByUserIdAndTenantId`) and tenant defaulting at the persist boundary
- [x] Idempotent earnings settlement per ride + `V5__backfill_missing_driver_earnings.sql` — `3d2d369`
- [x] Driver/Rider service errors return 409 via `RuntimeConflictException` (not 500)

### Testing
- [x] Backend suite verified 2026-10-16: 335 tests in 67 suites (334 passing, 1 skipped) — unit, integration, docs-endpoint profile and Flyway migration stability tests

---

## Frontend (velo-frontend/)

### Infrastructure
- [x] Turborepo monorepo with shared `api`, `ui`, `ws`, `config` packages — `8480ea9`, `ea224fe`
- [x] CI quality gates (frontend, backend, security, integration), staging-deploy scaffold, compose integration harness — `3f2676b`, `ed77cd1`

### Shared packages
- [x] `api` — client with response unwrapping, auth/rider/admin/driver/earnings/notifications/payments services, typed DTOs, contract tests — `00d92ec`, `6d3a004`
- [x] `ui` — primitives, composed, feedback, motion, theme layers; design tokens; dark mode — `ea224fe`
- [x] `ws` — STOMP client with JWT, subscription registry for reconnect safety, typed event parsing, `useNotifications`/`useRideUpdates` — `ea224fe`, `9d65d3c`

### Apps
- [x] Admin — BFF login, protected middleware, open-redirect sanitization, dashboard/drivers/users/payouts/promos/revenue/scheduled pages, create-user + onboard-driver, dispatch console + ops health — `e29c9b6`, `76093c7`, `5840efe`
- [x] Rider — auth + BFF, backend proxy gateway, booking with map + route preview, ride history + rating, scheduled rides, wallet, promos, notifications, active-trip lane — `95e0014`, `6a97fc3`, `c261a1f`
- [x] Driver — auth + registration, availability toggle, incoming-request popup, active ride (OTP → map → end), earnings + payout request, ride history, notifications, live location publishing — `d670470`, `be577ce`
- [x] Session control — logout BFF routes in all three apps, role-hint UX guard, WebSocket token cleanup — `8620eba`

### Design & UX
- [x] Complete — duotone design tokens, fluid type scale, Barlow Condensed + Inter, dark mode, page transitions + staggered reveals, responsive breakpoints, `prefers-reduced-motion`, landing rebuild + Lenis smooth scroll

### DevOps
- [x] Docker Compose local dev (PostgreSQL + PostGIS + Redis) with a native Apple Silicon PostGIS image — `d3ecf85`

---

## Documentation
- [x] `PRODUCT_VISION.md`, `ARCHITECTURE.md`, `SWAGGER.md`, `DEPLOYMENT.md`, `DESIGN_SYSTEM.md`, `FRONTEND_PLAN.md`, `BRANCHING.md`, `SECURITY_REMEDIATION.md`, `ADMIN_DEMO_SCRIPT.md`, `PROGRESS.md`
- [x] `decisions/` — decision ledger with backfilled architectural records
