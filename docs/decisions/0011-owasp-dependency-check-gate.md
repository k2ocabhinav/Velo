# 0011 — Strict dependency-check gate and profile-gated API docs

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-08

## Context

A platform shipped to other businesses must keep known-vulnerable dependencies out of the build, and its API documentation surface should not be reachable in production.

## Options considered

1. **Advisory-only scanning** — Pros: never blocks the build. Cons: findings get ignored.
2. **Strict gate with evidence-backed suppressions** — Pros: high-severity findings fail CI, and suppressions are time-boxed and owned. Cons: upstream scanner defects can block unrelated work.
3. **Blind suppressions** — rejected by policy.

## Decision

Run OWASP dependency-check as a strict CI gate; prefer BOM-driven dependency upgrades first; allow only evidence-backed suppressions that carry an owner and an expiry. Keep Swagger/OpenAPI enabled in local/dev/test and disabled in staging and production.

## Consequences

- Known dependency CVEs are driven to zero and kept there; API docs are not a production surface.
- **Risks:** upstream scanner defects—such as the NVD CVSS v4 `SAFETY` enum parser issue—can fail the gate for reasons unrelated to application code and are tracked as an open item.

## Related

- Docs: [`../SECURITY_REMEDIATION.md`](../SECURITY_REMEDIATION.md)
- Commits: `91cbc5c`, `605b0e1`, `b249485`
