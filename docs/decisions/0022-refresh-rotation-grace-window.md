# 0022 — Refresh rotation grace window and token cleanup

- **Status:** Accepted
- **Date:** 2026-10-14
- **Supersedes:** 0018 (refresh-token reuse handling only)

## Context

Parallel requests can present one refresh token to different BFF instances before either response reaches the browser. Treating the second request as theft revokes the session even when both requests belong to the same client. Refresh-token rows also need bounded retention as families rotate and expire.

## Options considered

1. **Keep immediate family revocation on every repeat.** Simple, but cross-instance request races can sign out a legitimate user.
2. **Allow a short replay window for the completed rotation.** Returns the same credentials to parallel requests while retaining reuse detection after the window.

## Decision

We will allow a configurable 20-second grace window. Each consumed token records its successor row and an AES-GCM encrypted copy of the exact access-token and refresh-token response, keyed from the configured JWT secret. A repeat during the window returns that same pair; a repeat after it revokes the family. An hourly job deletes expired tokens and tokens revoked for at least 30 days in batches of 500, scoped to one tenant per delete. Concurrent cleanup runs use `FOR UPDATE SKIP LOCKED`; deletion is idempotent, so a ShedLock-style single-run lock is unnecessary.

## Consequences

- Concurrent refresh requests across instances return one stable successor pair without process-local coordination.
- The replay ciphertext is useful only during the short grace window and is cleared with its token row.
- A JWT-secret rotation can invalidate a stored replay response; normal token and session rotation already requires clients to authenticate again.
- **Risks:** a replay inside the grace window is intentionally indistinguishable from a legitimate concurrent retry.

## Related

- Docs: [0018-refresh-token-rotation.md](0018-refresh-token-rotation.md)
