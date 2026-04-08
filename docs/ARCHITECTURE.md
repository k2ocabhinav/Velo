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

## Frontend Architecture

- Monorepo at `velo-frontend/` with apps (`admin`, `rider`, `driver`) and shared packages (`api`, `ui`, `ws`, `config`).
- Auth: Next.js BFF login route proxies to backend, stores JWT in httpOnly cookies. Middleware enforces protected routes.
- API: Backend proxy gateway (`/api/backend/[...path]`) bridges cookies to Bearer tokens.
- WebSocket: STOMP client with per-client subscription registry for reconnect safety.
- See `FRONTEND_PLAN.md` for full details.
