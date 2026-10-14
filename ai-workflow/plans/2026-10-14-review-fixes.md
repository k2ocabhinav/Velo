# Plan: Fixes from the 2026-10-14 Code Review

**Source:** `ai-workflow/reviews/2026-10-14-code-review/` (backend: deepseek-v4-pro; security: deepseek-v4.1-flash; the criticals were verified by the orchestrator).
**Executor:** Codex CLI, `gpt-6-luna` at `xhigh`, sandbox `workspace-write`, one git worktree and one test database per work package.
**Orchestrator:** Claude Code. It writes the prompts, reviews diffs, re-runs the tests itself, and merges.

## Work packages
Split by file ownership so WP1 and WP2 can run in parallel without conflicts. WP3 waits for the frontend review.

### WP1: Auth and secrets hardening (`security/auth-hardening`)
Owns: `SecurityConfig`, `JwtAuthenticationFilter`, `AuthController`, `AuthServiceImpl`, `WebSocketConfig`, `application*.properties`, the Flyway seed location.
1. **C1:** `/auth/onBoardNewDriver/{userId}` is no longer public. It requires authentication, and the caller may only onboard themselves (or an ADMIN in the same tenant may).
2. **#7:** narrow `JwtAuthenticationFilter.shouldNotFilter` to the genuinely public auth paths, so `/auth/profile` works.
3. **#4:** never log reset tokens.
4. **#9:** no user enumeration. Login gives one generic 401 for an unknown email or a wrong password; forgot-password always returns the same success response.
5. **#3:** `jwt.secret` and the DB credentials come from env vars in non-local profiles, and the app fails fast at startup if they're missing or still the dev default.
6. **#5:** the demo seed (`V2__seed_demo_data.sql`) moves to a demo-only Flyway location that's enabled only for local/dev/test profiles. Moving a migration keeps its checksum. **Never edit V1-V5 contents.**
7. **#10, #8, #13:** actuator: only `health` is public. WebSocket and CORS allowed origins come from config per profile; no wildcard.

### WP2: Payments, tenancy and concurrency (`backend/payment-tenancy-fixes`)
Owns: `Payment`, `PaymentServiceImpl`, `AdminController`/`AdminServiceImpl`, `PayoutServiceImpl`, `ScheduledRideServiceImpl`, `PromoCodeServiceImpl`, `RideServiceImpl`, `GlobalExceptionHandler`, DTOs, new migration `V6__*`.
1. **C2:** new migration `V6`: drop the unique constraint on `payment.user_id`; `Payment.user` becomes `@ManyToOne`. Regression test: one rider completes two paid rides.
2. **#2:** `GET /admin/users` returns a DTO with no password field. Also add `@JsonIgnore` on `User.password` as defence in depth.
3. **H1-H3 and #11:** tenant-scope admin user activate/deactivate, payouts (list, approve, reject, process), admin scheduled rides, and promo codes. Tests: a tenant-A admin can't act on tenant-B data (404).
4. **M2:** atomic payout processing (an APPROVED→PROCESSED compare-and-set or a row lock) so there's no double credit.
5. **M3:** promo `currentUses` gets an atomic increment, guarded by `maxUses`.
6. **M6:** ride OTP uses `SecureRandom`.
7. **M5:** scheduled dispatch runs each ride in its own transaction.
8. **M8:** the generic 500 handler returns a generic message and logs the detail.
9. **#12:** rating `@Min(1) @Max(5)`; branding color validated as hex.

### WP3: Frontend token handling (after the frontend review finishes)
**#6:** stop storing the API JWT in `sessionStorage`. Use a short-lived WS ticket from the backend, fetched through the BFF. **#14:** security headers (CSP, HSTS, frame-ancestors, nosniff) in each app. Scope will be confirmed once the kimi-k3 frontend review lands.

### Deferred (tracked, not in this round)
- Controllers returning `ResponseEntity` vs the raw-object convention (wide, low risk).
- N+1 queries in the admin dispatch views.
- Base fare not applied.
- `startRide` param naming.
- Docs drift (SWAGGER endpoint count, ARCHITECTURE seeding notes).

## Acceptance (per WP, checked by the orchestrator, not self-reported)
- `./mvnw test` passes on the WP's own DB, the test count is at or above the baseline, and new regression tests exist for each fix.
- The diff stays inside the WP's owned files, plus tests, migrations, and the docs it names.
- `docs/PROGRESS.md` items are ticked. A decision record covers the Flyway seed relocation (WP1) and the payment cardinality change (WP2).
- No edits to the contents of V1-V5. No `@Autowired`, no `jakarta.transaction.Transactional`.
