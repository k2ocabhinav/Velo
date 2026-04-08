# Velo — Progress Tracker

> Shared checklist for all agents. Check items when done. Add items as needed.

## How To Use
- `[x]` = done, `[ ]` = not done
- When you complete a task, change `[ ]` to `[x]` and add your commit hash
- When you discover new work, add it to the appropriate section with `[ ]`
- **Do NOT remove items** unless the user explicitly asks you to
- Keep descriptions short (one line per item)

---

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
- [ ] Design system tokens (Satoshi + General Sans fonts, full color system)
- [ ] Dark mode support
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
- [ ] Map integration (Mapbox GL JS) on booking page
- [ ] Real-time ride tracking (WebSocket + map)
- [ ] "Finding driver" animation/loading state
- [ ] Rider booking E2E tests

### Driver App
- [x] Starter shell — `9765ba6`
- [ ] Login + BFF auth route
- [ ] Availability toggle (online/offline)
- [ ] Incoming ride request popup (WebSocket)
- [ ] Active ride flow (OTP verify → map → end ride)
- [ ] Earnings dashboard
- [ ] Payout request page
- [ ] Ride history page
- [ ] Notifications page

### Design & UX
- [ ] Implement design system tokens from DESIGN_SYSTEM.md
- [ ] Satoshi + General Sans font integration
- [ ] Multi-tenant theme loading (middleware → Redis → inline CSS)
- [ ] Smooth page transitions (Framer Motion)
- [ ] Staggered list animations
- [ ] Responsive breakpoints (mobile-first rider/driver, desktop-first admin)
- [ ] WCAG 2.1 AA accessibility audit
- [ ] prefers-reduced-motion support
- [ ] Loading/skeleton states for every data component

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
