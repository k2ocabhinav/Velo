# Velo — Progress Tracker

> Shared checklist for all agents. Check items when done. Add items as needed.

## How To Use
- `[x]` = done, `[ ]` = not done
- When you complete a task, change `[ ]` to `[x]` and add your commit hash
- When you discover new work, add it to the appropriate section with `[ ]`
- **Do NOT remove items** unless the user explicitly asks you to
- Keep descriptions short (one line per item)

---

## 2026-04-15 Stabilization Snapshot
- [x] Driver matching fallback includes online approved drivers without current location metadata (prevents silent no-offer cases in demo traffic)
- [x] Rider/driver identity lookups hardened to tenant-scoped queries (`findByUserIdAndTenantId`)
- [x] Service wiring hardened: removed partial constructor injection paths that could pass `null` runtime dependencies
- [x] Earnings settlement made idempotent per ride and backfilled via Flyway `V5__backfill_missing_driver_earnings.sql`
- [x] Canonical portal ports documented and aligned (`4100` landing, `4101` admin, `4102` requester, `4103` driver)
- [x] Tenant defaulting fallback added at entity persist boundary for legacy/test setup compatibility (`Driver`, `Rider`, `Ride`, `RideRequest`, `RideOffer`, `Wallet`, `PaymentMethodEntity`, `DriverEarning`, `PayoutRequest`)
- [x] Backend regression suite passing: `197` tests, `0` failures/errors
- [x] Frontend unit + contract suites passing
- [x] Frontend Playwright e2e stabilization completed after UI contract alignment (`20/20` passing)
- [x] Rider/Driver/Admin button alignment + responsive interaction polish pass completed (no layout regressions in smoke flows)
- [x] Visual status feedback pass completed (live pills, countdown badge, matching indicator, skeleton replacements for text-only loading)

## Backend (velo-platform/)

### Core (complete)
- [x] Ride lifecycle (request → accept → OTP → start → end → payment)
- [x] Driver matching strategies (nearest, highest-rated)
- [x] Fare calculation strategies (default, surge)
- [x] Cash + wallet payment strategies
- [x] Promo code engine (flat/percentage, usage limits, admin CRUD)
- [x] Scheduled rides with auto-dispatch
- [x] WebSocket notifications (STOMP/SockJS) + persistent history
- [x] Driver earnings dashboard + payout system
- [x] Admin panel (stats, revenue, driver approval, payout management)
- [x] JWT auth, role-based access (RIDER, DRIVER, ADMIN)
- [x] Password reset flow
- [x] Profile update API
- [x] Driver availability toggle
- [x] Payment methods CRUD
- [x] CORS configuration for frontend origins

### Security (in progress)
- [x] Security config: scoped auth endpoints (not /auth/**)
- [x] Correct @Transactional import (Spring, not Jakarta)
- [x] Password reset token not leaked in response
- [x] Swagger/OpenAPI docs exposure policy
- [x] OWASP dependency-check baseline — `91cbc5c`
- [ ] Dependency-check NVD CVSS v4 parser fix (upstream blocker)
- [ ] Refresh token mechanism (nice-to-have)
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enforcement config for production

### Testing
- [x] 158 backend tests passing
- [x] DocsEndpoint integration tests (local/prod/staging profiles)
- [ ] Auth endpoint integration tests for new features (profile, password reset)

---

## Frontend (velo-frontend/)

### Infrastructure
- [x] Turborepo monorepo initialized — `8480ea9`
- [x] Shared packages: api, ui, ws, config — `ea224fe`
- [x] Admin app shell with protected routes — `2bb87ed`
- [x] Rider + driver starter shells — `9765ba6`
- [x] CI: frontend-quality workflow — `fc6ac87`
- [x] CI: backend-quality workflow — `3f2676b`
- [x] CI: security workflow — `3f2676b`
- [x] CI: integration-e2e workflow — `3f2676b`
- [x] CI: staging-deploy scaffold — `ed77cd1`
- [x] Compose integration harness — `3f2676b`

### packages/api
- [x] API client with response unwrapping — `00d92ec`
- [x] Auth service (login, signup) — `00d92ec`
- [x] Rider service (fare estimate, request ride, history, scheduled) — `6d3a004`
- [x] Admin service (stats, drivers, users, payouts, promos) — `6d3a004`
- [x] Driver/earnings/notifications/payments services — `00d92ec`
- [x] TypeScript types matching backend DTOs — `00d92ec`
- [x] API contract tests — `00d92ec`

### packages/ui
- [x] Primitives: button, input, dialog — `ea224fe`
- [x] Composed: data-table, stat-card, status-badge — `ea224fe`
- [x] Motion: page-transition, stagger, fade-in, presence — `ea224fe`
- [x] Feedback: skeleton, spinner, error-boundary, toast — `ea224fe`
- [x] Theme: provider, tokens, tenant-resolver, fonts — `ea224fe`
- [x] Design system tokens (Barlow Condensed + Inter fonts, duotone color system)
- [x] Dark mode support (toggle + localStorage persistence + prefers-color-scheme)
- [ ] Skeleton variants for each composed component (.Skeleton exports)

### packages/ws
- [x] STOMP client with JWT auth — `ea224fe`
- [x] Subscription registry for reconnect safety — `6d3a004`
- [x] Typed notification/ride event parsing — `6d3a004`
- [x] useNotifications + useRideUpdates hooks — `ea224fe`
- [ ] Exponential backoff reconnection strategy
- [ ] Visual "Reconnecting..." indicator component

### Admin App
- [x] BFF login route (httpOnly cookie) — `e29c9b6`
- [x] Protected route middleware — `e29c9b6`
- [x] Open-redirect sanitization — `e29c9b6`
- [x] Dashboard page (stats/revenue cards) — `76093c7`
- [x] Driver approvals page — `76093c7`
- [x] User management page — `76093c7`
- [x] Payout approvals page — `76093c7`
- [x] Promo codes page — `76093c7`
- [x] Revenue reports page — `76093c7`
- [x] Scheduled rides page — `76093c7`
- [x] Admin user creation form + onboard-as-driver action — `6a97fc3`
- [ ] Admin action E2E tests (approve/reject/process flows)
- [ ] Loading skeletons for all data pages
- [ ] Error states with retry for all API-backed pages

### Rider App
- [x] Login/register pages + BFF routes — `95e0014`
- [x] Protected route middleware — `95e0014`
- [x] Backend proxy gateway (/api/backend/[...path]) — `95e0014`
- [x] Booking page (fare estimate + request ride) — `95e0014`
- [x] Rides history page — `95e0014`
- [x] Scheduled rides page (create/reschedule/cancel) — `95e0014`
- [x] Wallet page — `95e0014`
- [x] Promos page — `95e0014`
- [x] Notifications page — `95e0014`
- [x] Map integration (Leaflet/OSM) on booking page — interactive pickup/drop-off selection with route preview
- [ ] Real-time ride tracking (WebSocket + map)
- [ ] "Finding driver" animation/loading state
- [ ] Rider booking E2E tests

### Driver App
- [x] Starter shell — `9765ba6`
- [x] Login + BFF auth route
- [x] Driver registration page (two-step: signup → onboard as driver) — `6a97fc3`
- [x] Availability toggle (online/offline)
- [x] Incoming ride request popup (WebSocket)
- [x] Active ride flow (OTP verify → map → end ride)
- [x] Earnings dashboard
- [x] Payout request page
- [x] Ride history page
- [x] Notifications page

### Design & UX
- [x] Implement design system tokens (duotone palette, fluid type scale, section spacing)
- [x] Barlow Condensed + Inter font integration (via next/font/google)
- [ ] Multi-tenant theme loading (middleware → Redis → inline CSS)
- [x] Smooth page transitions (Framer Motion FadeIn on all app shells)
- [x] Staggered list/scroll-reveal animations (landing page sections)
- [x] Responsive breakpoints (mobile-first rider/driver, desktop-first admin)
- [ ] WCAG 2.1 AA accessibility audit
- [x] prefers-reduced-motion support (disables all animations)
- [ ] Loading/skeleton states for every data component
- [x] Dark mode support (toggle in admin, rider, driver apps)
- [x] Landing page rebuild (hero, tagline, verticals accordion, stats, marquee, how-it-works, footer)
- [x] Lenis smooth scroll on landing page

---

## DevOps & Deployment
- [x] Docker Compose for local dev (PostgreSQL + Redis)
- [x] CI workflows (frontend, backend, security, integration)
- [x] Staging deploy scaffold
- [ ] Production Dockerfile for Spring Boot
- [ ] S3 + CloudFront setup for frontend
- [ ] ECS Fargate task definition
- [ ] RDS PostgreSQL provisioning
- [ ] Environment variable management (Secrets Manager)
- [ ] Production application-prod.properties (ddl-auto=validate)

---

## Documentation
- [x] PRODUCT_VISION.md
- [x] ARCHITECTURE.md
- [x] SWAGGER.md (60 endpoints)
- [x] DEPLOYMENT.md
- [x] DESIGN_SYSTEM.md
- [x] FRONTEND_PLAN.md
- [x] PROGRESS.md (this file)
- [x] BRANCHING.md
- [x] SECURITY_REMEDIATION.md
- [x] CLAUDE.md (agent instructions)

---

## Implementation Status Update (2026-04-08 — Driver MVP)

### Driver vertical slice delivered (mapless, API-backed)
- Driver auth/session flow implemented: `/login`, BFF login route, httpOnly cookie session, safe redirect sanitization.
- Driver route protection implemented with middleware for `/`, `/ride/[id]`, `/rides`, `/earnings`, `/notifications`.
- Driver backend proxy implemented at `/api/backend/[...path]` for cookie -> Bearer forwarding.
- Driver core pages implemented:
  - `/` availability toggle + incoming request actions
  - `/ride/[id]` OTP start/end/cancel flow
  - `/rides` paginated ride history
  - `/earnings` summary + payout request + payout/earnings history
  - `/notifications` unread/read flows
- Realtime behavior implemented with WebSocket subscription and REST refresh fallback.

### Testing and quality coverage added in this pass
- Driver unit tests:
  - login redirect safety and middleware behavior
  - login BFF timeout/network/upstream mapping
  - payout and ride action validation helpers
- API contract tests expanded for:
  - driver ride action endpoint contracts
  - notifications unread/read/read-all endpoint contracts
- Driver Playwright smoke suite added:
  - auth redirect
  - availability toggle success/conflict
  - accept -> start(OTP) -> end flow
  - earnings payout happy path
  - notifications action failure path rendering
- Integration handshake expanded with driver login/profile and availability probe.

## Implementation Status Update (2026-04-08 — Rider Lifecycle Hardening)

### Rider lifecycle and integration tightening
- Rider realtime notifications now use the shared ws subscription pattern with reconnect state surfaced in the UI.
- Rider ride history now includes post-ride rating actions with clearer pending/error handling.
- Integration gating now runs rider Playwright smoke as a required CI job.

### Testing and quality coverage added in this pass
- Rider smoke coverage now includes booking, history, notifications, and rating flows.
- Compose handshake checks now fail fast if driver availability mutations return unexpected statuses.

## Implementation Status Update (2026-04-08 — Session Control + Frontend Integration Readiness)

### Core functionality delivered in this pass
- Session control is now first-class across Admin/Rider/Driver:
  - `POST /api/auth/logout` added in all three frontend apps.
  - Protected shells now expose visible `Logout` action and deterministic sign-out behavior.
  - Rider/Driver logout now clears `sessionStorage` WebSocket token (`velo_ws_token`).
- Role-safe access behavior tightened without backend contract changes:
  - login proxy sets `velo_role_hint`.
  - middleware uses role hint only for early UX guard (fallback allowed when hint absent).
- Rider booking surface continuity hardened:
  - trip lane now keeps `PENDING -> CONFIRMED -> ONGOING -> ENDED/CANCELLED` continuity messaging.
  - realtime notification events trigger trip lane refresh.
  - adaptive polling cadence (faster when active/pending, slower when idle).
  - cancellable active trip action added on booking surface.
- Frontend-backend integration harness now validates Admin + Rider + Driver through each app’s frontend proxy/BFF path (not admin-only).

### Manual QA Quickstart (append-only)
- URLs:
  - Admin: `http://localhost:3000`
  - Rider: `http://localhost:3001`
  - Driver: `http://localhost:3002`
- Seed credentials:
  - Admin: `admin@velo-platform.com` / `password123`
  - Rider: `alice@example.com` / `password123`
  - Driver: `eve.driver@example.com` / `password123`
- Smoke order:
  1. Admin login -> dashboard load -> users/drivers/payout action.
  2. Rider login -> fare estimate -> request ride -> ride lane continuity.
  3. Driver login -> toggle availability -> accept/start/end flow.
  4. Logout from each app -> protected route redirects back to login.
- Known constraint:
  - map/live GPS visualization remains deferred in this phase.

## Implementation Status Update (2026-04-09 — Core Prototype Gap Fixes)

### Backend exception type fixes
- DriverServiceImpl: 10 RuntimeException → RuntimeConflictException (acceptRide, cancelRide, startRide, endRide, rateRider) — HTTP 500 → 409 for frontend mapApiError() to handle correctly
- RiderServiceImpl: 4 RuntimeException → RuntimeConflictException (cancelRide, rateDriver) — same pattern
- All 35 service tests pass (DriverServiceImplTest 23, RiderServiceImplTest 12)

### Driver registration flow
- New /register page at apps/driver/app/register/ — collects name, email, password, vehicleId
- Two-step BFF at apps/driver/app/api/auth/register/route.ts: POST /auth/signup → POST /auth/onBoardNewDriver/{userId}
- /register added to driver middleware publicPaths
- "Don't have an account? Register" link added to driver login page

### Admin user & driver management
- Admin users page now has "+ Create user" collapsible form (firstName, lastName, email, password)
- Admin users page now has per-row "Onboard as driver" button with vehicleId prompt
- admin-client.ts: createUser() and onboardDriver() methods added

### Rider booking UX cleanup
- Rider booking page: hardcoded Bangalore coordinates removed (empty strings on init)
- Booking page sections reordered: map-first (Select on map → Trip details → Latest estimate → Latest ride request)
- Scheduled rides page: same coordinate cleanup

## Implementation Status Update (2026-04-09 — Rider Core Completion + Cross-App Reliability)

### Core delivery in this pass
- Added additive backend tracking contracts for live lifecycle continuity:
  - `PUT /drivers/location`
  - `GET /riders/active-ride`
  - rider realtime updates on `/user/queue/ride-updates` with typed ride/location events.
- Added dedicated Rider active continuity surface at `/ride/active`:
  - active trip guard redirects from booking/history/scheduled when an in-flight ride exists
  - status timeline + finding-driver state + map markers + route fallback when routing provider fails.
- Added driver location publisher flow in frontend with adaptive cadence and graceful geolocation fallback.
- Added shared async action-state utility and applied it to action-heavy Rider/Admin/Driver pages for deterministic lock/retry/loading/error behavior.

### Testing and QA status in this pass
- Frontend gates green: `lint`, `typecheck`, `test:unit`, `test:contracts`, `build`.
- Playwright rider/admin/driver smoke suites green, including rider active-trip continuity checks.
- Backend gates green: `./mvnw -q test`, `./mvnw -q -DskipTests package`.
- Compose integration handshake green from clean state (`down -v` before run), including assertions for:
  - rider active-ride endpoint through frontend proxy
  - driver location update mutation through frontend proxy.

## Implementation Status Update (2026-04-09 — Runtime + Registration Stabilization)

### Core fixes delivered
- Fixed standalone frontend runtime host binding regression by forcing `HOSTNAME=0.0.0.0` in `start-standalone.mjs`, resolving Admin/Driver/Rider login pages getting stuck on "Loading sign-in form...".
- Fixed driver register BFF contract mismatch:
  - signup payload now uses `name` (backend `SignupDto` contract),
  - onboarding `userId` is resolved via login fallback when signup response omits id.
- Kept backend security alignment for public driver onboarding path (`/auth/onBoardNewDriver/**`) in security config.

### Verification status
- Frontend quality gates passed:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
- Playwright smoke passed for all three apps: **19/19**.
- Compose frontend-backend handshake passed from clean docker state (`down -v` then up).
- Backend package build passed with tests skipped (`./mvnw -q -DskipTests package` in container).
- Full backend `./mvnw -q test` is currently red in this environment due existing integration-fixture FK integrity issues outside this patch scope; no new failures from the frontend runtime/register fixes.

## Implementation Status Update (2026-04-10 — Admin Dispatch Console + Sign-In Rendering Fix)

### Core delivery in this pass
- Added Admin dispatch console at `/dispatch` with API-backed operations:
  - pending requests queue
  - active rides queue
  - per-request offer visibility
  - assign / reassign / force-cancel actions (reason-required backend contract)
  - dispatch audit trail feed
  - ops health snapshot (Redis availability, cache counters, queue depth).
- Extended admin dashboard with a compact ops-health panel.
- Fixed Admin/Driver/Rider sign-in rendering freeze by removing client `useSearchParams` dependency from login/register form mount path and resolving `next` on the server page boundary.

### Verification status
- Frontend gates passing:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `npm run test:e2e -- --project=admin-chromium`
- Backend package gate passing:
  - `./mvnw -q -DskipTests package`
- Backend full test suite currently requires local PostgreSQL (`localhost:5432`) in this environment.

## Implementation Status Update (2026-04-10 — Admin Ops Completion Hardening)

### Reliability and verification closure
- Added backend integration coverage for admin dispatch endpoints:
  - assign/reassign/force-cancel flows
  - validation failures (`400`) for missing reason
  - conflict behavior for unapproved driver assignment
  - single-winner acceptance race behavior for two drivers.
- Added Flyway migration verification tests for deterministic baseline creation and seed stability across repeat migrate/clean+migrate cycles.
- Fixed Flyway seed migration runtime issue (`SELECT setval(...)` inside PL/pgSQL block) by using `PERFORM setval(...)`, unblocking clean DB bootstraps.
- Integration handshake expanded with admin dispatch and persistence verification modes:
  - mutation pass writes a known dispatch audit marker
  - restart pass verifies marker/state persistence without volume reset.
- CI gates hardened:
  - backend quality workflow now provisions PostGIS-backed PostgreSQL service for `./mvnw -q test`
  - integration workflow now requires admin WebKit smoke in addition to Chromium suites.
  - compose handshake mutation + restart-persistence passes are verified green end-to-end.

### Demo support
- Added focused demo runbook: `docs/ADMIN_DEMO_SCRIPT.md`.
