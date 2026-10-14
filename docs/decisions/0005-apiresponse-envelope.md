# 0005 — Uniform `ApiResponse` envelope from all controllers

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-07

## Context

Without a shared convention, every controller would shape its own success and error bodies, forcing every client to special-case every endpoint. The frontend needs one predictable shape to unwrap in one place.

## Options considered

1. **Per-endpoint response shapes** — Pros: no framework hook needed. Cons: inconsistent clients, error handling scattered across call sites.
2. **A `ResponseBodyAdvice` that wraps every controller return in a common envelope** — Pros: one uniform success/error shape, controllers stay clean. Cons: global behavior that must exclude non-JSON endpoints and that tests must know about.

## Decision

`GlobalResponseHandler` (a `ResponseBodyAdvice`) wraps all controller returns in `ApiResponse<>` with `data` / `error` / `statusCode`. Controllers return raw objects and never wrap manually. The advice excludes `/v3/api-docs` and `/actuator`.

## Consequences

- Clients unwrap `.data` once, centrally; tests assert against `$.data` / `$.error`.
- Controllers stay free of envelope code.
- **Risks:** new non-JSON or framework endpoints must be added to the exclusions or they get wrapped.
- Rationale not recorded at the time; the convention has been in place since the initial commit.

## Related

- Docs: [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md)
- Commits: `499fbc3`
