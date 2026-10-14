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

### Critical fixes (found in the 2026-10-14 code review)
- [x] Lock down `/auth/onBoardNewDriver/{userId}`: currently public and grants DRIVER to any user (9ceda0f)
- [ ] Drop the `payment.user_id` UNIQUE constraint and make `Payment.user` `@ManyToOne` (a rider's second paid ride fails)
- [ ] Stop serializing password hashes in `GET /admin/users` (return a DTO)
- [x] Stop logging password-reset tokens (`AuthServiceImpl`) (9ceda0f)
- [x] Prod must not inherit the dev `jwt.secret` or DB credentials: source them from the environment and fail fast if unset (9ceda0f)

### Security & production readiness (highest priority)
- [ ] HTTPS enforcement config for production
- [ ] Rate limiting on auth endpoints
- [ ] Dependency-check NVD CVSS v4 parser fix (upstream blocker)
- [ ] Refresh token mechanism (nice-to-have)
- [ ] Production Dockerfile for Spring Boot
- [ ] Production `application-prod.properties` (`ddl-auto=validate`)
- [ ] Environment variable management (Secrets Manager)
- [ ] RDS PostgreSQL provisioning
- [ ] ECS Fargate task definition
- [ ] S3 + CloudFront setup for frontend

### Backend
- [ ] Auth endpoint integration tests for new features (profile, password reset)

### Frontend — reliability & UX
- [ ] `packages/ws`: exponential backoff reconnection strategy
- [ ] `packages/ws`: visual "Reconnecting..." indicator component
- [ ] `packages/ui`: skeleton variants for each composed component (`.Skeleton` exports)
- [ ] Rider: real-time ride tracking (WebSocket + map)
- [ ] Rider: "Finding driver" animation/loading state
- [ ] Admin: loading skeletons for all data pages
- [ ] Admin: error states with retry for all API-backed pages
- [ ] Loading/skeleton states for every data component

### Frontend — testing
- [ ] Admin action E2E tests (approve/reject/process flows)
- [ ] Rider booking E2E tests

### Accessibility & theming
- [ ] Multi-tenant theme loading (middleware → Redis → inline CSS)
- [ ] WCAG 2.1 AA accessibility audit

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
- [x] 197 backend tests passing (unit + integration), including docs-endpoint profile tests and Flyway migration stability tests — `3d2d369`

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
