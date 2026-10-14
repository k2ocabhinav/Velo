# 0003 — httpOnly cookie session with a BFF proxy

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-08

## Context

The backend issues stateless JWTs and expects `Authorization: Bearer` on every request. Browser apps must hold that token somewhere. A token in `localStorage` is readable by any script on the page, so a single XSS bug becomes session theft.

## Options considered

1. **JWT in `localStorage`** — Pros: trivial to implement, works with any fetch. Cons: readable by JavaScript, so XSS steals the session.
2. **httpOnly cookie set by a Next.js BFF route** — Pros: not readable by JavaScript, sent automatically. Cons: needs a proxy to convert the cookie back to a Bearer header, and cookie/CSRF handling must be deliberate.
3. **Token in memory only** — Pros: not persisted, so harder to steal. Cons: lost on refresh; poor UX for long-lived dashboards.

## Decision

Store the JWT in an httpOnly cookie set by each app's BFF login route (documented rationale: it "prevents XSS theft"). Every app exposes a backend proxy gateway (`/api/backend/[...path]`) that reads the cookie and attaches the Bearer header, and middleware enforces protected routes. JWTs are never stored in `localStorage`.

## Consequences

- Sessions survive reloads without exposing the token to page scripts.
- Every app carries a BFF/proxy layer; logout must clear the cookie explicitly.
- A role-hint cookie (`velo_role_hint`) is used only for early UX routing, never for authorization.
- **Risks:** the proxy must forward upstream status/errors faithfully, and cookie policy must differ correctly between local and production environments.

## Related

- Docs: [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- Commits: `e29c9b6`, `8620eba`, `fb55621`
