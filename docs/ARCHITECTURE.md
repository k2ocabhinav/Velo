# Velo — Architecture Reference

> This document describes the current codebase structure, conventions, and setup. It is the technical reference for anyone working on the code.

## Tech Stack

- **Runtime:** Java 22, Spring Boot 3.3.1
- **Database:** PostgreSQL + PostGIS (Hibernate Spatial)
- **Auth:** Stateless JWT (Spring Security + JJWT)
- **Mapping:** ModelMapper (entity <-> DTO)
- **Annotations:** Lombok throughout
- **API Docs:** SpringDoc OpenAPI (Swagger UI at `/swagger-ui/index.html`)
- **WebSocket:** Spring WebSocket (STOMP over SockJS)
- **Caching:** Redis (optional, dependencies present)
- **Monitoring:** Spring Boot Actuator

## Source Layout

Package: `com.velo.platform`.

```
src/main/java/com/velo/platform/
  actuator/          Custom health indicators
  advices/           GlobalResponseHandler, GlobalExceptionHandler
  aspect/            RequestLoggingAspect
  configs/           SecurityConfig, MapperConfig, RedisConfig, FareConfig,
                     PlatformConfig, WebSocketConfig, ScheduledRideConfig,
                     ScheduledRideDispatcher, WebSocketAuthInterceptor,
                     MetricsConfig
  controllers/       AuthController, RiderController, DriverController,
                      AdminController, NotificationController,
                      DriverEarningsController, PromoCodeController,
                      PaymentMethodController
  dto/               All DTOs (flat package), dto/admin/ for admin-specific
  entities/          JPA entities
  entities/enums/    RideStatus, RideRequestStatus, PaymentMethod,
                      PaymentStatus, Role, TransactionType, TransactionMethod,
                      NotificationType, PayoutStatus, DiscountType
  entities/          User, Rider, Driver, Ride, RideRequest, Wallet,
                      WalletTransaction, Payment, Rating, Notification,
                      PromoCode, PromoCodeUsage, DriverEarning, PayoutRequest,
                      PasswordResetToken, PaymentMethodEntity
  events/            Application event classes + NotificationEventListener
  exceptions/        ResourceNotFoundException, RuntimeConflictException
  repositories/      Spring Data JPA repositories
  security/          JwtAuthenticationFilter, JwtTokenProvider, UserPrincipal,
                     CorrelationIdFilter
  services/          Service interfaces
  services/impl/     Service implementations
  strategies/        RideFareCalculationStrategy, DriverMatchingStrategy,
                     PaymentStrategy interfaces + RideStrategyManager,
                     PaymentStrategyManager
  strategies/impl/   Strategy implementations
  utils/             GeometryUtil
```

## Key Patterns

### Dependency Injection
Constructor injection via Lombok `@RequiredArgsConstructor`. Never `@Autowired`.

### Transactions
`@Transactional` on all mutation methods. `@Transactional(readOnly = true)` on reads.

### DTO Mapping
ModelMapper configured in `configs/MapperConfig`. If custom mappings are needed, add them there.

### API Response Wrapping
`GlobalResponseHandler` (a `ResponseBodyAdvice`) automatically wraps all controller returns in `ApiResponse<>`. Controllers return raw objects — never wrap manually. Excludes `/v3/api-docs` and `/actuator` paths.

### Exception Handling
- `ResourceNotFoundException` -> HTTP 404
- `RuntimeConflictException` -> HTTP 409
- All handled by `GlobalExceptionHandler` via `@RestControllerAdvice`

### Strategy Pattern
Two strategy managers select behavior at runtime:
- **`RideStrategyManager`** — selects fare calculation (default vs surge between 6-9 PM) and driver matching (nearest vs highest-rated for riders with rating >= 4.8)
- **`PaymentStrategyManager`** — routes to `CashPaymentStrategy` or `WalletPaymentStrategy`

Strategy interfaces: `RideFareCalculationStrategy`, `DriverMatchingStrategy`, `PaymentStrategy`.

### Event-Driven Notifications
Services publish events via `ApplicationEventPublisher` (e.g., `RideAcceptedEvent`). `NotificationEventListener` handles each event, creates a persistent `Notification` record, and pushes via WebSocket (`SimpMessagingTemplate.convertAndSendToUser`).

### Current User Resolution
```java
UserPrincipal principal = (UserPrincipal) SecurityContextHolder
    .getContext().getAuthentication().getPrincipal();
Long userId = principal.getUserId(); // This is User.id
// Then: riderRepository.findByUserId(userId) or driverRepository.findByUserId(userId)
```
`UserPrincipal.getUserId()` maps to `User.id`, not `Rider.id` or `Driver.id`.

### Entity Conventions
- `@Version` for optimistic locking
- `@Index` on frequently queried columns
- Override `equals`/`hashCode` using ID only
- `@ToString.Exclude` on lazy associations
- `@Enumerated(EnumType.STRING)` always

### Controller Conventions
- `@Tag` + `@Operation` + `@SecurityRequirement(name="bearerAuth")` on all secured endpoints

### Config Externalization
`@ConfigurationProperties` classes in `configs/`: `FareConfig`, `PlatformConfig`, `ScheduledRideConfig`.

## Database Setup

**Prerequisites:** PostgreSQL running on localhost:5432 with PostGIS extension.

| Database | Purpose |
|---|---|
| `postgres` | Main application database |
| `testpostgres` | Test database |

- User: `postgres`, Password: `user`
- DDL mode: `create-drop` (schema recreated on every boot)
- `data.sql` seeds data on normal startup; tests skip it via `spring.sql.init.mode=never`

## Testing

### Build & Test Commands
```bash
cd velo-platform
./mvnw clean install   # Build
./mvnw test            # Run all tests
./mvnw spring-boot:run # Run the application
```

### Test Security
Integration tests use `TestSecurityConfig` which bypasses JWT and reads auth from headers:
- `X-Test-User-Id` — the user ID
- `X-Test-Email` — user email
- `X-Test-Role` — role (RIDER, DRIVER, ADMIN)

### Test Assertions
Because `GlobalResponseHandler` wraps everything, JSON assertions target `$.data` or `$.error`.

### Test Data Builders
Reusable builders in `testdata/` package: `UserTestBuilder`, `RiderTestBuilder`, `DriverTestBuilder`, `RideTestBuilder`, `RideRequestTestBuilder`, `WalletTestBuilder`.

### Current Test Count
158 tests (unit + integration), all passing.

## Ride Lifecycle

1. Rider requests ride -> `RiderService.requestRide()` calculates fare, finds matching drivers
2. Driver accepts -> `DriverService.acceptRide()` creates Ride with OTP
3. Driver starts ride with OTP verification -> `DriverService.startRide()`
4. Driver ends ride -> `DriverService.endRide()` triggers payment + earnings record
5. Both parties can rate each other via `RatingService`
6. Events are published at each step, creating notifications for both parties

## Implementation Status Update (2026-04-08)

### Frontend Architecture Baseline Added
- A frontend monorepo now exists at `velo-frontend/` with apps (`admin`, `rider`, `driver`) and shared packages (`api`, `ui`, `ws`, `config`).
- Admin authentication now includes a Next.js BFF login route that proxies to backend auth and stores JWT in httpOnly cookies.
- Admin protected-route middleware is active with safe redirect sanitization.
- Frontend API contracts are aligned to backend controller paths and Spring page response shapes.

### Quality/Verification Architecture Added
- Repository workflows now enforce frontend/backend/security/integration checks.
- Compose-based frontend-backend handshake script validates auth/session and protected route behavior.

### Testing Status (2026-04-08)
- Current layers:
  - Frontend unit (admin/api/ws)
  - Frontend API contract tests
  - Frontend E2E smoke
  - Frontend-backend integration handshake
  - Backend regression suite
  - Security checks in CI
- Phase 2 coverage gaps to close:
  - Rider MVP unit + e2e behavior tests
  - Admin action-flow e2e assertions
  - Expanded integration scenarios for booking lifecycle paths

## Implementation Status Update (2026-04-08)

### Architecture Progress Snapshot
- Frontend architecture is operating as a monorepo adjunct to the backend, with typed API and websocket packages as the integration boundary.
- Auth/session architecture is centered on Next.js BFF login + httpOnly cookie + protected-route middleware.
- Backend route contracts remain authoritative; frontend contract surface extends without breaking existing exports.

### Testing Status (Unit/Contracts/E2E/Integration/Backend/Security)
- Current layers:
  - Unit: frontend logic tests (auth/middleware/forms/helpers/ws internals).
  - Contracts: API method/path/payload and response-unwrapping assertions in `packages/api`.
  - E2E: Playwright smoke checks for baseline UI auth/navigation behavior.
  - Integration: compose-driven frontend-backend handshake checks.
  - Backend: Maven unit/integration regression suite.
  - Security: static/dependency checks via CI workflows.
- Passing now (baseline currently recorded):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:contracts`
  - `npm run build`
  - `./mvnw -q test`
- Phase 2 gaps:
  - Full rider booking lifecycle coverage from UI through integration flow.
  - Admin operation-action E2E coverage (approve/reject/activate/deactivate/process paths).
  - WS reconnection and subscription-safety regression coverage under reconnect scenarios.

## Implementation Status Update (2026-04-08, Phase 2 Architecture Progress)

### Architecture deltas in this run
- Rider web architecture now includes:
  - auth entry routes (`/login`, `/register`) and BFF auth routes (`/api/auth/login`, `/api/auth/register`)
  - protected-route middleware enforcement with safe `next` path sanitization
  - backend proxy gateway route (`/api/backend/[...path]`) for cookie-to-bearer bridging.
- Admin architecture now uses live API-backed pages for operational screens while preserving route surfaces.
- Shared reliability architecture expanded in websocket layer:
  - per-client subscription registry for reconnect-safe re-subscription
  - typed notification and ride update event parsing.
- API contract layer expanded with non-breaking additions while preserving existing exports.

### Testing Status (2026-04-08, Phase 2 Architecture Progress)
- Current layers active:
  - Unit: admin/rider/ws/api helper and middleware tests.
  - Contracts: endpoint method/path/payload assertions in `packages/api`.
  - E2E: Playwright smoke for admin + rider key flows.
  - Integration: compose handshake script updated with rider backend flow assertions.
  - Backend: Maven unit/integration suite.
  - Security: npm audit + dependency-check workflow path.
- Verified now:
  - frontend lint/typecheck/unit/contracts/build pass
  - admin/rider e2e smoke pass
  - backend tests pass.
- Known external caveat:
  - OWASP dependency-check can fail during NVD update on CVSS v4 `SAFETY` enum parsing; this is upstream feed/parser compatibility, not a Velo architecture defect.

## Security Remediation Note (2026-04-08)

- The remediation baseline, suppression policy, and NVD key handling notes live in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).
- Use that document as the architecture-side reference for dependency vulnerability follow-up and current remediation posture.

## Implementation Status Update (2026-04-08, Security Remediation Pass 2)

- Dependency versions for `commons-lang3`, `log4j-api`/`log4j-to-slf4j`, and `swagger-ui` are now pinned to patched versions via Maven dependency management.
- `springdoc.swagger-ui.version` is explicitly aligned to the overridden webjar version so local/dev/test docs endpoints resolve correctly.
- Verification and CVE comparison for this pass are tracked in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).
