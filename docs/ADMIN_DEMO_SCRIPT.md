# Admin Demo Script

This short script demonstrates dispatch correctness, PostgreSQL persistence, and Redis visibility in the prototype.

## 1) Dispatch race (single winner)

1. Sign in as Admin (`http://localhost:3000`) and open **Dispatch**.
2. Keep two Driver sessions open (`http://localhost:3002`) with approved drivers.
3. Create/request one rider trip (or use seeded pending request).
4. Let both drivers attempt acceptance.
5. Verify:
   - first accept succeeds
   - second accept receives conflict/already-booked behavior
   - admin dispatch audit shows the action history.

## 2) Persistence proof (PostgreSQL)

1. In Admin Dispatch, perform one override action with a clear reason (assign/reassign/cancel).
2. Restart services without wiping volumes.
3. Sign back in and verify:
   - dispatch audit still contains the previous override reason
   - resulting ride/request state remains updated.

## 3) Redis visibility proof (ops health)

1. Open Admin Dashboard or Dispatch console.
2. Read **Ops health**:
   - Redis connectivity
   - cache hit/miss/error counters
   - queue depth and expired offer counters.
3. If Redis is unavailable, verify UI remains usable and shows fallback/degraded status (DB-backed behavior).
