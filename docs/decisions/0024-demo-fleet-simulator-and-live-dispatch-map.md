# 0024 — Demo fleet simulator and live dispatch map

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Demos have no real riders or drivers, so the admin desk looks static and only the presenter's single scripted trip moves. The admin Dispatch page also has no map of where drivers are: it shows lists that refresh only after an action. Vendors usually demo on curated, resettable demo tenants; moving synthetic fleets mostly exist as internal engineering simulators (Uber, Lyft, DoorDash). A live fleet that follows real roads would make Velo's demo stand out, provided every screen agrees with it.

## Options considered

1. **Bots that use the public API and WebSocket** (a separate Node process).
   - Pros: exercises real dispatch, offers, payments and notifications. No simulator code in the product backend.
   - Cons: needs dedicated accounts, token refresh, and care with auth rate limits.
2. **Direct database writes.**
   - Pros: simple.
   - Cons: bypasses validation, notifications and lifecycle logic, and couples to the schema. A demo built this way proves nothing.
3. **A "sim mode" inside the backend.**
   - Pros: one-click control.
   - Cons: adds risk of shipping simulator paths to production, and makes the backend more complex.

For the live map:

1. **Polling a tenant-scoped snapshot every 3 seconds, with client-side tweening.**
   - Pros: simple, cacheable, and works through the BFF.
2. **Pushing over STOMP to admins.**
   - Pros: lower latency.
   - Cons: needs tenant-scoped admin topics and their authorisation.

## Decision

We will build a demo simulator as a workspace package, `velo-frontend/packages/demo-sim`, that drives dedicated simulated drivers and riders through the public REST and STOMP APIs. Movement follows a precomputed OSRM route catalogue for Bengaluru, and the simulator is started and stopped by the demo launcher. Simulated accounts carry `app_user.simulated = true`. Dispatch matching only pairs simulated riders with simulated drivers, and real riders with real drivers, so the simulator can never take the presenter's trip or send offers to the presenter's driver. The simulator refuses to start unless it is explicitly allowed, uses a loopback API, targets allowlisted demo tenants and uses simulated accounts.

The admin Dispatch page gains a live fleet map fed by `GET /api/v1/admin/dispatch/live`, which returns a tenant-scoped snapshot of drivers and open trips. The page polls it every 3 seconds while visible and tweens markers between snapshots. Drivers now persist when their location was last updated, plus their heading and speed (V13).

Polling won over push because it reuses the BFF and auth, and its cost is one small query set per admin every 3 seconds.

## Consequences

- The demo shows a living fleet, and the map is a real product feature, not demo-only.
- Matching gains an isolation predicate on `simulated`. Real data defaults to `false`, so behaviour is unchanged for real users.
- **Risks:**
  - Simulated data must never reach production. Seeds live only in the demo migration path, and the simulator has fail-closed checks.
  - Use of the public OSRM server is limited to building the catalogue once (one request per second or slower).

## Related

- `ai-workflow/research/2026-10-15-demo-simulator.md` (local research)
- `docs/DEMO_SCRIPT.md`
- 0020 (tenant theme loading)
