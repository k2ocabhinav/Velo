# 0018 — Rotating refresh tokens for BFF sessions

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The existing session uses a JWT with a one-day lifetime, stored in an httpOnly cookie by each app's BFF. Short-lived access JWTs need a revocable way to renew sessions, detect stolen-token replay, and end sessions without exposing refresh credentials to browser JavaScript.

## Options considered

1. **Long-lived signed refresh JWTs.** No token table is needed; revocation and replay detection require a separate denylist or key rotation.
2. **Opaque rotating refresh tokens stored as hashes.** Supports single-use rotation, family revocation, and targeted logout; requires database state and cleanup.

## Decision

We will issue random opaque refresh tokens, store only their SHA-256 hashes in tenant-scoped PostgreSQL rows, rotate them on refresh, and revoke the token family on reuse or logout. Access JWTs last 15 minutes. The BFF keeps both credentials in Secure, httpOnly, SameSite=Lax cookies; the refresh cookie uses the `/api` path so backend proxy routes can refresh after a 401.

## Consequences

- Refresh credentials can be revoked and replay can terminate the affected session family.
- BFF proxy requests can renew sessions without exposing either credential to browser code.
- Refresh rotation depends on PostgreSQL availability and adds a row per rotation until expiry cleanup is added.
- **Risks:** concurrent refreshes reaching separate BFF processes may race; process-local single-flight only coordinates requests handled by one process.

## Related

- Docs: `0016-websocket-ticket-auth.md`
