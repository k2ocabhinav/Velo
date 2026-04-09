# Velo — Frontend Development Plan

> This document is the execution plan for building the Velo frontend. Any agent or developer should be able to pick up from here.

## Prerequisite Reading
- `docs/DESIGN_SYSTEM.md` — visual language, theming, animations, loading states (READ THIS FIRST)
- `docs/ARCHITECTURE.md` — backend patterns and conventions
- `docs/SWAGGER.md` — API inventory (60 endpoints across 8 groups)

## Tech Stack (Final)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Monorepo | Turborepo | latest |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | latest |
| Server State | TanStack Query | v5 |
| Client State | Zustand | v5 |
| Animation | Framer Motion (motion/react) | latest |
| Maps | Mapbox GL JS (or Leaflet) | latest |
| WebSocket | @stomp/stompjs + sockjs-client | latest |
| Forms | React Hook Form + Zod | latest |
| Fonts | Satoshi + General Sans (Fontshare) | latest |
| Testing | Vitest (unit) + Playwright (E2E) | latest |

### Why These Choices
- **shadcn/ui over Material-UI/Ant Design**: Components are copied into the project, not imported from a library. Full ownership, no design lock-in. Critical for white-label theming.
- **Zustand over Redux Toolkit**: Same capabilities for this app, 90% less boilerplate.
- **@stomp/stompjs over Socket.io**: Spring Boot uses STOMP over SockJS. Using the native protocol client avoids translation layers.
- **Turborepo monorepo**: Three apps (admin, rider, driver) share an API client, TypeScript types, and UI components from one repo.

## Project Structure

```
velo-frontend/
├── turbo.json
├── package.json
├── apps/
│   ├── admin/          # Admin dashboard (Phase 1)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Dashboard overview
│   │   │   ├── drivers/
│   │   │   │   └── page.tsx       # Driver approvals
│   │   │   ├── users/
│   │   │   │   └── page.tsx       # User management
│   │   │   ├── payouts/
│   │   │   │   └── page.tsx       # Payout approvals
│   │   │   ├── promo-codes/
│   │   │   │   └── page.tsx       # Promo code CRUD
│   │   │   ├── revenue/
│   │   │   │   └── page.tsx       # Revenue reports
│   │   │   └── scheduled-rides/
│   │   │       └── page.tsx       # Scheduled rides overview
│   │   ├── next.config.ts
│   │   └── package.json
│   ├── rider/          # Rider web app (Phase 2)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Map + booking
│   │   │   ├── rides/
│   │   │   │   └── page.tsx       # Ride history
│   │   │   ├── scheduled/
│   │   │   │   └── page.tsx       # Scheduled rides
│   │   │   ├── wallet/
│   │   │   │   └── page.tsx       # Wallet & payments
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx       # Notification center
│   │   │   └── promos/
│   │   │       └── page.tsx       # Available promos
│   │   └── package.json
│   └── driver/         # Driver web app (Phase 3)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx           # Availability toggle + incoming requests
│       │   ├── ride/
│       │   │   └── [id]/
│       │   │       └── page.tsx   # Active ride (OTP, map, end ride)
│       │   ├── earnings/
│       │   │   └── page.tsx       # Earnings dashboard + payouts
│       │   ├── rides/
│       │   │   └── page.tsx       # Ride history
│       │   └── notifications/
│       │       └── page.tsx       # Notification center
│       └── package.json
└── packages/
    ├── ui/             # Shared design system (see DESIGN_SYSTEM.md for full spec)
    │   ├── src/
    │   │   ├── primitives/    # shadcn/ui base components (button, input, dialog, etc.)
    │   │   ├── composed/      # Higher-level: data-table, stat-card, ride-card, status-badge
    │   │   ├── feedback/      # skeleton, spinner, progress-bar, toast-provider, error-boundary
    │   │   ├── motion/        # page-transition, stagger, fade-in (Framer Motion wrappers)
    │   │   └── theme/         # theme-provider, tokens.css, fonts, tenant-resolver
    │   └── package.json
    ├── api/            # Shared API client + types
    │   ├── src/
    │   │   ├── client.ts          # axios instance with JWT interceptor
    │   │   ├── types.ts           # All DTOs as TypeScript interfaces
    │   │   ├── auth.ts            # login, signup, profile
    │   │   ├── rides.ts           # ride requests, history, scheduled
    │   │   ├── drivers.ts         # driver endpoints
    │   │   ├── admin.ts           # admin endpoints
    │   │   ├── notifications.ts   # REST + WebSocket
    │   │   ├── payments.ts        # wallet, payment methods
    │   │   ├── promo-codes.ts     # promo endpoints
    │   │   └── earnings.ts        # driver earnings + payouts
    │   └── package.json
    ├── ws/             # Shared WebSocket service
    │   ├── src/
    │   │   ├── stomp-client.ts    # STOMP connection manager
    │   │   └── hooks.ts           # useNotifications, useRideUpdates
    │   └── package.json
    └── config/         # Shared Tailwind + TypeScript config
        ├── tailwind.config.ts
        ├── tsconfig.base.json
        └── package.json
```

## Build Phases

### Phase 1: Admin Dashboard
**Goal:** Validate all admin APIs, build a debugging/management tool.

**Pages:**
| Page | Endpoints Used | Complexity |
|---|---|---|
| Dashboard (stats) | `GET /api/v1/admin/stats/dashboard`, `GET /api/v1/admin/stats/daily` | Low |
| Revenue Reports | `GET /api/v1/admin/stats/revenue` | Low |
| Driver Approvals | `GET /api/v1/admin/drivers/pending`, `POST .../approve`, `POST .../reject` | Low |
| User Management | `GET /api/v1/admin/users`, `POST .../activate`, `POST .../deactivate` | Low |
| Payout Approvals | `GET /api/v1/admin/payouts/pending`, `POST .../approve/reject/process` | Medium |
| Promo Codes | Full CRUD on `/api/v1/admin/promo-codes` | Medium |
| Scheduled Rides | `GET /api/v1/admin/scheduled-rides` | Low |

**Shared packages built in this phase:**
- `packages/api` — API client with JWT interceptor, all admin service functions
- `packages/ui` — data-table, card, badge, button, dialog, form components
- `packages/config` — Tailwind theme, TypeScript base config

**Backend prerequisite:** Add CORS configuration. One config class:
```java
// In SecurityConfig.java, add to the filter chain:
.cors(cors -> cors.configurationSource(corsConfigurationSource()))

// Add bean:
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOriginPatterns(List.of("http://localhost:*"));
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

### Phase 2: Rider Web App
**Goal:** Complete ride booking flow with map.

**Pages:**
| Page | Key Features | Complexity |
|---|---|---|
| Login / Register | JWT auth, token storage in httpOnly cookie | Low |
| Map + Booking | Mapbox, fare estimate, ride request | High |
| Active Ride | Real-time status via WebSocket, driver location | High |
| Ride History | Paginated list of past rides | Low |
| Scheduled Rides | Create, reschedule, cancel | Medium |
| Wallet | Balance, transactions | Low |
| Notifications | WebSocket + REST fallback, unread badge | Medium |
| Promo Codes | Apply promo, view active promos | Low |

**Shared packages extended in this phase:**
- `packages/api` — rider service functions, types
- `packages/ws` — STOMP client, notification hooks
- `packages/ui` — map component, ride status card, notification bell

### Phase 3: Driver Web App
**Goal:** Real-time ride management, earnings tracking.

**Pages:**
| Page | Key Features | Complexity |
|---|---|---|
| Home (Availability) | Online/offline toggle, incoming ride requests via WebSocket | High |
| Active Ride | OTP verification, navigation map, end ride | High |
| Earnings Dashboard | Summary (daily/weekly/monthly), balance, payout request | Medium |
| Payout History | List of payouts with status | Low |
| Ride History | Past rides with ratings | Low |
| Notifications | Same as rider (shared package) | Low (reuse) |

### Phase 4: Mobile (Deferred)
Options when ready:
- **Capacitor**: Wrap the Next.js web apps as native iOS/Android apps. Fastest path, adequate for MVP.
- **React Native**: Rebuild with native components. Better UX long-term but significant effort.
- **PWA**: Add service worker to Next.js apps. Works offline, installable, zero app store overhead.

Recommendation: Start with PWA (add `next-pwa`), evaluate Capacitor if app store presence needed.

## Theming & Design System

Full specification in `docs/DESIGN_SYSTEM.md`. Key points:
- 3-layer token system: primitives → semantics → component overrides
- Tenants configure: primary color, accent color, logo, fonts, border-radius style
- Tenants CANNOT customize: layout, spacing, motion, accessibility, typography scale
- Theme resolved server-side (middleware → Redis cache → injected as inline CSS) — zero flash
- Dark mode support per-tenant opt-in
- RTL-ready via CSS logical properties from day one
- Fonts: Satoshi (display) + General Sans (body) + JetBrains Mono (codes/OTPs)

## Authentication Flow

```
Browser                    Next.js                   Spring Boot
  │                          │                          │
  │─── POST /auth/login ────▶│─── proxy ───────────────▶│
  │                          │◀── { token, userId } ────│
  │◀── Set httpOnly cookie ──│                          │
  │                          │                          │
  │─── GET /riders/profile ──▶│─── attach Bearer token ─▶│
  │◀── user data ────────────│◀── ApiResponse<Rider> ───│
```

- JWT stored in httpOnly cookie (not localStorage) — prevents XSS theft
- Next.js API route `/api/auth/login` acts as BFF proxy, sets the cookie
- All subsequent requests: Next.js middleware reads cookie, attaches `Authorization` header
- On 401: redirect to `/login` with "session expired" message

## WebSocket Integration

```typescript
// packages/ws/src/stomp-client.ts
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export function createStompClient(token: string) {
  return new Client({
    webSocketFactory: () => new SockJS(`${API_URL}/ws`),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 5000,
  });
}

// Subscribe to personal notifications:
// client.subscribe('/user/queue/notifications', callback)
```

## API Response Shape

All backend responses are wrapped by `GlobalResponseHandler`:
```typescript
interface ApiResponse<T> {
  data: T;         // on success
  error: string;   // on error
  statusCode: number;
}
```

Frontend API client should unwrap `.data` automatically in the interceptor.

## What the Frontend Does NOT Handle
The backend already handles all of these — the frontend is purely a thin UI layer:
- Fare calculation (strategy pattern on backend)
- Driver matching (strategy pattern on backend)
- Payment processing (cash/wallet strategies on backend)
- Surge pricing logic
- Promo code validation and discount calculation
- Scheduled ride dispatch
- Notification persistence and delivery
- OTP generation and verification
- Rating calculations

The frontend only needs to: call the right endpoint, display the response, and listen for WebSocket events.

## Implementation Status Update (2026-04-08)

### Phase 1 Foundation Completed
- `velo-frontend/` monorepo scaffold is implemented and merged to `main`.
- Admin app includes:
  - protected route shell (`/`, `/drivers`, `/users`, `/payouts`, `/promo-codes`, `/revenue`, `/scheduled-rides`)
  - auth BFF route (`/api/auth/login`) and cookie-based session flow
  - open-redirect-safe middleware and login redirect handling
- Rider and driver shells exist and run on dedicated ports (`3001`, `3002`).
- Shared packages are active:
  - `packages/api`: backend-aligned service clients + response/page unwrapping
  - `packages/ui`: primitives/composed/motion/feedback/theme layers
  - `packages/ws`: STOMP client + hooks
  - `packages/config`: shared TS/Tailwind config primitives

### Quality and Delivery Baseline Implemented
- Workspace quality gates are in place (lint/typecheck/unit/contracts/build).
- CI workflows are in place for frontend quality, backend quality, security, and compose integration handshake.
- Integration harness currently verifies:
  - backend reachability/openapi
  - login BFF cookie behavior
  - protected route redirect/authenticated load behavior
  - backend protected endpoint JWT acceptance

### Testing Status (2026-04-08)
- Existing test layers:
  - Admin auth/middleware unit tests
  - API client unit tests
  - API contract tests against current backend shape
  - Playwright admin smoke
  - compose-based integration handshake
- Current validated command set:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
- Phase 2 testing gaps to close:
  - Rider auth/session unit tests
  - Rider booking/scheduled validation tests
  - Rider + admin action Playwright scenarios
  - additional WS reconnect/resubscribe behavior tests

## Implementation Status Update (2026-04-08)

### What Is Implemented Now
- Monorepo foundation is active under `velo-frontend/` with Turborepo tasks and shared packages.
- Admin app includes:
  - Protected route middleware.
  - Login BFF proxy route with httpOnly session cookies.
  - Dashboard/ops pages scaffolded and ready for API wiring.
- Shared frontend infrastructure includes:
  - `packages/api` with backend-aligned endpoint contracts and Spring page unwrapping.
  - `packages/ws` STOMP client + hooks baseline.
  - `packages/ui` primitives/composed components/motion/theme modules.
- CI and quality scaffolding is in place:
  - Frontend/backend/security/integration workflows.
  - Playwright smoke test baseline.
  - Compose handshake integration harness.

### Testing Status (2026-04-08)
- Current layers:
  - Unit tests: admin auth/login, api client helpers, ws stomp client.
  - Contract tests: `packages/api/tests/contracts`.
  - E2E smoke: admin redirect/login shell behavior.
  - Integration handshake: backend-openapi + admin login + protected-route checks.
  - Backend regression + security scans through workflows.
- Current known gap themes for Phase 2:
  - Rider booking/session/scheduled flow test coverage.
  - Admin data-action end-to-end coverage.
  - Expanded integration scenarios beyond handshake.

### Phase 2 Delta from This Plan
- Admin pages move from placeholders to live API-backed views with action flows.
- Rider app gains full MVP routes: auth/session, booking, history, scheduled, wallet/promos/notifications.
- WS reliability and typed event handling are hardened for multi-subscription safety.
- E2E and integration coverage expand to include rider happy path and failure-path auth behavior.

## Implementation Status Update (2026-04-08)

### Phase 2 Execution Alignment
- This phase is focused on Rider MVP plus Admin live API wiring, with shared contract-first updates in `packages/api`.
- Workstream ownership is parallelized across admin, rider, ws reliability, API contracts, and CI/staging checks.
- Route surfaces in apps remain stable while behavior transitions from placeholder state to backend-backed state.

### Testing Status (Unit/Contracts/E2E/Integration/Backend/Security)
- Current layers:
  - Unit: frontend page/form/middleware/helper tests in Vitest.
  - Contracts: typed API surface contract tests in `packages/api/tests/contracts`.
  - E2E: Playwright baseline smoke coverage.
  - Integration: compose handshake script validating auth/protected-route/back-end acceptance.
  - Backend: `./mvnw -q test` regression suite.
  - Security: audit/dependency-check CI workflows.
- Passing now (current scaffold baseline):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `./mvnw -q test`
- Phase 2 gaps to close in this plan:
  - Rider auth/session and booking/scheduled unit test coverage completion.
  - WS reconnect/resubscribe and duplicate-handler prevention tests.
  - Playwright expansion for admin action path and rider happy/failure paths.
  - Integration expansion for rider fare estimate and ride request (happy + invalid payload).

## Implementation Status Update (2026-04-08, Phase 2 Execution)

### Delivered in this phase
- Admin live wiring completed for:
  - dashboard stats/revenue cards
  - drivers/users moderation actions
  - payouts/promo/scheduled pages with API-backed loading/error states.
- Rider MVP wiring completed for:
  - login/register session entry
  - booking (fare estimate + request ride)
  - rides history
  - scheduled create/reschedule/cancel
  - wallet/promos/notifications.
- Shared packages updated:
  - `packages/ws`: reconnect/resubscribe registry and typed event parsing.
  - `packages/api`: non-breaking contract additions and path-rating/register support.
- CI/CD scaffolding expanded:
  - rider Playwright project path
  - staging deployment gate scaffold
  - frontend quality gate now includes unit + contracts.

### Testing Status (2026-04-08, Phase 2 Execution)
- Unit coverage now includes:
  - rider form validation + submit-state helpers
  - rider open-redirect and middleware redirect safety
  - ws reconnect/subscription registry behavior
  - admin login BFF and redirect sanitizer flows.
- Contract coverage now includes:
  - rider booking endpoints (`fare-estimate`, `requestRide`)
  - non-breaking path-rating/register endpoint contracts
  - unsupported endpoint non-exposure assertions.
- E2E coverage now includes:
  - admin smoke redirect + action flow + readable error surface
  - rider smoke booking + scheduled + redirect + error surface.
- Integration/backend/security in this run:
  - backend regression tests passed (`./mvnw -q test`)
  - frontend audit passed (`npm audit --audit-level=high`)
  - compose integration command is CI-gated when Docker is unavailable locally
  - dependency-check may fail due upstream NVD CVSS v4 parser incompatibility (`SAFETY` enum), not app-code regression.

## Security Remediation Note (2026-04-08)

- Frontend-facing security follow-up, including docs exposure policy and the dependency-check remediation baseline, is tracked in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).
- Use that note when coordinating future frontend-auth, API-docs, or security workflow changes.

## Implementation Status Update (2026-04-08, Security Remediation Pass 2)

- Backend security dependency remediation for this phase is complete and keeps frontend API/route contracts stable.
- `/v3/api-docs` and `/swagger-ui/**` behavior remains profile-governed: local/dev/test enabled, staging/prod disabled.
- Full security scan comparison and command-level verification are documented in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).

## Implementation Status Update (2026-04-08, Rider Lifecycle Hardening)

- Rider lifecycle now includes active-ride continuity, notifications live-state handling, and rating completion from ride history.
- Shared websocket behavior is reused for rider live updates with deterministic reconnect behavior.
- Integration gating now requires rider Playwright smoke alongside admin and driver smoke coverage.

## Implementation Status Update (2026-04-08, Session Control + Integration Coverage)

- Session lifecycle now includes explicit logout BFF routes in Admin, Rider, and Driver apps with cookie cleanup.
- Protected shells now provide user-visible logout actions with deterministic redirect-to-login behavior.
- Role hint cookie (`velo_role_hint`) is now set during login and used by middleware for early UX-safe routing.
- Rider booking trip lane continuity now includes pending-driver state, realtime-triggered refresh, and adaptive polling.
- Compose integration handshake now validates frontend-connected flows for:
  - Admin: login + protected shell + user activation/deactivation mutation path.
  - Rider: login + fare estimate + request ride + trip lane source endpoint.
  - Driver: login + profile + availability toggle path.

### Testing Delta in this pass
- Added unit coverage for:
  - auth middleware role-hint fallback/mismatch behavior
  - logout utility cleanup behavior
  - logout routes in all three frontend apps
  - rider trip-lane state selection helpers.
- Added/extended Playwright coverage for:
  - logout flow in Admin, Rider, Driver (post-logout protected-route blocking).
- Integration harness now asserts auth cookie policy and runs full app-level frontend->backend checks.

## Implementation Status Update (2026-04-09, Rider Core Completion + Cross-App Reliability)

- Rider continuity now has a dedicated `/ride/active` route with active-ride guard redirects from booking/history/scheduled surfaces.
- Rider live updates now consume typed ride update events and apply dedupe/reconnect-safe handling with polling fallback.
- Driver app now publishes live location updates during active rides with adaptive cadence and graceful permission degradation.
- Map/routing flow is modularized for provider swap by environment; dev defaults use OSM tiles + OSRM routing with fallback path behavior.
- Shared async action-state helper now standardizes per-action locks, retry behavior, and loading/error handling across Rider/Admin/Driver action-heavy views.

### Testing Status Delta (2026-04-09)
- Added unit coverage for:
  - rider active state transitions and redirect guard behavior
  - rider map/routing adapter fallback parsing
  - rider ws ride-update parsing/dedupe
  - driver location cadence/stop conditions
  - shared async action-state utility.
- Added/expanded contracts for:
  - `PUT /drivers/location`
  - `GET /riders/active-ride`.
- Rider/admin/driver Playwright smoke remains green with rider active lifecycle assertions.
- Compose integration handshake now enforces active-ride and location update backend-connected assertions.

## Implementation Status Update (2026-04-09, Runtime + Session Entry Stabilization)

- Fixed standalone startup host binding behavior so Admin/Driver/Rider sign-in forms render reliably in docker/local runtime.
- Driver register BFF now follows backend auth contracts (`name` for signup) and resolves onboarding `userId` through login fallback when needed.
- Current QA snapshot for this stabilization pass:
  - Frontend gates: `lint`, `typecheck`, `test:unit`, `test:contracts`, `build` all passing.
  - Playwright smoke: admin + driver + rider all passing (19/19).
  - Compose handshake: passing from clean state.
