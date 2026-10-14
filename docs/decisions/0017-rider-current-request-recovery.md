# 0017 — Recover the rider's current request from the backend

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The rider home page stores its latest request in component state, while ride history contains only rides. A pending `RideRequest` has no `Ride` until a driver accepts it, so a reload loses the request lane and can enable another submission. The backend must also handle concurrent submissions because a client-side guard alone cannot enforce one in-flight request per rider.

## Options considered

1. **Rebuild the lane from ride history.**
   - Pros: no new API route.
   - Cons: pending requests are absent from ride history.
2. **Expose a tenant-scoped current-request lookup and guard writes on the server.**
   - Pros: reloads use persisted state; the backend can return a conflict for duplicates.
   - Cons: adds a request lookup and serializes submissions for the same rider.

## Decision

We will expose `GET /riders/current-request` for a rider's pending or confirmed request and reject another request with HTTP 409 while one exists. The create operation locks the tenant-scoped rider row before checking request status so concurrent submissions see the prior committed request.

## Consequences

- The rider lane and duplicate guard can recover from a reload.
- Scheduled requests do not block a new immediate request.
- **Risks:** the rider row lock serializes ride-request creation for one rider.

## Related

- Code: `velo-platform/src/main/java/com/velo/platform/services/impl/RiderServiceImpl.java`
- Code: `velo-frontend/apps/rider/app/page.tsx`
