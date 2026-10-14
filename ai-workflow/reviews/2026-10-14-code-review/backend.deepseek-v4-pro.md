I've completed a deep review of `velo-platform/src/main`. Here's my report.

## Summary
The codebase is well-structured and mostly follows the documented conventions (Spring `@Transactional`, `@RequiredArgsConstructor`, tenant-scoped identity lookups), but there are two **Critical** issues — unauthenticated driver onboarding and a `payment.user_id UNIQUE` constraint that breaks any rider's second trip — plus several cross-tenant leaks in admin/payout paths and race conditions in payout/promo settlement. Multi-tenant isolation is only partially enforced: writes are inconsistently scoped and several admin endpoints operate globally.

## Findings

### Critical
| # | Title | Location | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| C1 | Unauthenticated driver onboarding / privilege escalation | `SecurityConfig.java:45`, `AuthController.java:42`, `AuthServiceImpl.java:124-143` | `/auth/onBoardNewDriver/**` is in `permitAll()`, and `JwtAuthenticationFilter.shouldNotFilter` skips all `/auth/**`. `onboardNewDriver` reads no principal and adds `Role.DRIVER` to any `userId`. | Any anonymous caller can grant DRIVER role and create a `Driver` row for an arbitrary user. | Require `ADMIN` (`@PreAuthorize`) and remove from `permitAll()`; scope to caller's tenant. |
| C2 | `payment.user_id` UNIQUE breaks second trip | `V1__baseline_schema.sql:104`, `Payment.java:34-35`, `PaymentServiceImpl.java:36-44` | `payment.user_id BIGINT UNIQUE`; `Payment.user` is `@OneToOne`; `createNewPayment` sets `user = ride.getRider().getUser()`. | A rider's second ride fails at `startRide` with `DataIntegrityViolationException` → 500. | Change `Payment.user` to `@ManyToOne` and drop the `user_id` unique constraint (payment is per-ride, not per-user). |

### High
| # | Title | Location | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| H1 | Cross-tenant user deactivate/activate | `AdminServiceImpl.java:196-210` | `deactivateUser`/`activateUser` do `userRepository.findById(userId)` with no tenant check, unlike `approveDriver`/`suspendDriver`/`rejectDriver`. | Tenant A admin can deactivate/activate Tenant B users by ID. | Verify `user.getTenantId().equals(currentTenantId())` before mutating. |
| H2 | Payout admin endpoints not tenant-scoped | `PayoutServiceImpl.java:64-108,112-115` | `getPendingPayouts` uses `findByStatusOrderByRequestedAtAsc` (global); approve/reject/process fetch by ID with no tenant check. | Tenant-scoped admin sees and approves/rejects/processes other tenants' payouts. | Add `tenantId` filters/queries and tenant ownership checks. |
| H3 | Admin "all scheduled rides" is global | `ScheduledRideServiceImpl.java:118-124` | `getAllScheduledRides` → `findByRideRequestStatusOrderByScheduledTimeAsc` with no tenant filter. | Tenant admin sees other tenants' scheduled rides. | Filter by `currentTenantId()`. |

### Medium
| # | Title | Location | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| M1 | `syncRideRequestStatus` targets wrong request | `RideServiceImpl.java:104-123` | No `Ride→RideRequest` FK; on cancel/end it flips `findTopByRiderAndRideRequestStatus(CONFIRMED)` — the rider's *latest* confirmed request, not this ride's. | With multiple rides, cancelling/ending one ride marks a different request CANCELLED/EXPIRED. | Add `ride.rideRequestId` FK and update that exact row. |
| M2 | `processPayout` double-credit race | `PayoutServiceImpl.java:94-108` | Status check (APPROVED) → `addMoneyToWallet` → set PROCESSED, no atomic guard. | Two concurrent `processPayout` calls both credit the wallet. | CAS on status (`APPROVED→PROCESSED`) or DB lock before crediting. |
| M3 | Promo usage/`currentUses` race | `PromoCodeServiceImpl.java:113-152` | `existsByPromoCodeAndUser` check then save, and `currentUses+1` read-modify-write, are non-atomic. | `maxUses` can be oversold; one user can double-apply under concurrency. | Unique constraint (exists) + optimistic lock/`currentUses` CAS. |
| M4 | `estimateFare` has no `@Transactional` | `FareEstimationServiceImpl.java:39-77` | Method unannotated; lazy `rider.getUser()` accessed at lines 61/77 relies on OSIV. | LazyInitializationException if `open-in-view` is disabled; inconsistent with read convention. | Add `@Transactional(readOnly=true)`. |
| M5 | `dispatchScheduledRides` catches `Exception` inside `@Transactional` | `ScheduledRideServiceImpl.java:128-175` | Per-item `try/catch(Exception)` inside one transaction loop. | A rollback-only exception poisons the whole dispatch cycle (`UnexpectedRollbackException`); some dispatches silently lost. | Use per-ride transactions (self-injection) or don't catch rollback-marking exceptions. |
| M6 | Weak OTP generation | `RideServiceImpl.java:80-84` | `new Random().nextInt(10000)` + `%04d`. | Predictable OTP undermines start-ride verification. | Use `SecureRandom` / cryptographically random OTP. |
| M7 | Cash payment deducts from driver wallet without balance check | `CashPaymentStrategy.java:25-35` | `deductMoneyFromWallet(driver.getUser(), commission, …)` never checks balance; class lacks `@Transactional` (relies on caller). | Driver wallet can go arbitrarily negative; no guard against over-deduction. | Add balance/floor validation and `@Transactional`. |
| M8 | 500 handler leaks internal messages | `GlobalExceptionHandler.java:56-63` | Generic handler returns `exception.getMessage()`. | SQL/stack internals exposed to clients. | Return generic message; log the detail server-side. |
| M9 | `/actuator/**` and `/ws/**` are `permitAll` | `SecurityConfig.java:52-53` | Both matchers permit all requests. | Actuator health exposed unauthenticated; WS auth delegated entirely to interceptor (unverified). | Restrict actuator exposure and require auth on `/ws/**` handshake. |

### Low
- **L1** Fare strategies never apply `app.fare.base-fare` — `RiderFareDefaultRideFareCalculationStrategy.java:21-26` / surge variant compute `distance*perKm` only.
- **L2** `DriverController.startRide` path var named `rideRequestId` but `DriverServiceImpl.startRide` treats it as `rideId` (`DriverController.java:38-43` vs `DriverServiceImpl.java:168`) — contract mismatch with `SWAGGER.md`.
- **L3** Rider/Driver controllers mostly lack `@PreAuthorize` role checks (only `/availability` and `/location` have them); relies on entity-lookup 404s for role separation.
- **L4** N+1: `AdminDispatchServiceImpl.getPendingRideRequests` calls `countByRideRequestIdAndStatus` per row (line 154); `getActiveRides`/`getRideOffers` lazy-load `user` per row (lines 167-169, 187).
- **L5** Completed rides set the ride *request* to `EXPIRED` (no `COMPLETED` status) — `RideServiceImpl.java:113-115` (flagged `DEMO_STUB`).
- **L6** `DriverRepository.findTenNearestDrivers(pickupLocation)` / `findTenNearbyTopRatedDrivers(pickupLocation)` default to `tenantId=1L` — currently dead code but a latent cross-tenant footgun (`DriverRepository.java:82-88`).
- **L7** `forgotPassword` logs the plaintext reset token at INFO — `AuthServiceImpl.java:180`.
- **L8** `data.sql`/`schema.sql` are dead (`spring.sql.init.mode=never`, Flyway owns schema) and duplicate the V2 seed; `ARCHITECTURE.md` still documents `create-drop` + `data.sql`.

## Gaps
- **"Idempotent earnings settlement per ride" (PROGRESS)** — true for `driver_earning` (unique `ride_id` in V1 + `existsByRide_Id`/`DataIntegrityViolationException` catch), but **payment and payout are not idempotent** (M2; `PaymentServiceImpl.processPayment` re-processes with no status guard).
- **"Tenant-scoped identity lookups … and tenant defaulting" (PROGRESS)** — identity lookups are scoped, but H1/H2/H3 show admin/payout/scheduled paths are not tenant-scoped.
- **"Driver/Rider service errors return 409" (PROGRESS)** — mostly true, but C2 (payment unique) and other `DataIntegrityViolationException`s still surface as 500.
- **"60 endpoints" (SWAGGER.md)** — the admin dispatch console adds many endpoints (`/dispatch/*`, `/ops-health`) not reflected in the API inventory.
- **"197 tests passing" (PROGRESS)** — not verified here (no test run in scope).

## Convention violations (AGENTS.md)
Counted examples:
1. Missing `@Transactional(readOnly=true)` on reads — e.g. `FareEstimationServiceImpl.estimateFare` (no annotation at all); also `TenantConfigurationService`/`NotificationServiceImpl` are fine, but this is the notable offender.
2. Controllers returning `ResponseEntity` instead of raw objects — `AuthController`, `RiderController`, `DriverController`, `AdminController`, `TenantController` all use `ResponseEntity.ok(...)` (convention says "controllers return raw objects").
3. `@SecurityRequirement(name="bearerAuth")` + `@Operation` present on secured controllers, but `AuthController` public endpoints and `onBoardNewDriver` lack a `@PreAuthorize`/role boundary (contributes to C1).

No `jakarta.transaction.Transactional` or `@Autowired` found in `src/main` — those two conventions are clean.
