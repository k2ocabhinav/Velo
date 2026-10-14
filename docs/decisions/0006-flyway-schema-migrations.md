# 0006 — Flyway migrations with `ddl-auto=validate`

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-10

## Context

Schema changes must be deterministic and reviewable; letting Hibernate create or mutate the schema is unacceptable for a database holding real data. The platform needed a single versioned source of truth for the schema.

## Options considered

1. **Hibernate `ddl-auto=create-drop` / `update`** — Pros: zero migration authoring. Cons: destructive or fragile, no review trail, not production-safe.
2. **Flyway versioned migrations** — Pros: ordered, reviewable, deterministic bootstraps. Cons: every change needs a migration file.
3. **Liquibase** — Pros: similar guarantees via changelogs. Cons: a second viable option that was not chosen. [`DEPLOYMENT.md`](../DEPLOYMENT.md) frames it as "Use Flyway or Liquibase for schema migrations."

## Decision

Flyway owns the schema in `velo-platform/src/main/resources/db/migration/`, with `ddl-auto=validate` and `spring.sql.init.mode=never` outside local dev. The migrations are `V1__baseline_schema.sql`, `V2__seed_demo_data.sql`, `V3__tenant_branding_and_isolation.sql`, `V4__admin_dispatch_merchant_mode.sql`, `V5__backfill_missing_driver_earnings.sql`.

## Consequences

- Clean databases bootstrap deterministically; production stays on `validate`.
- Every schema change is a reviewed migration.
- **Risks:** seed/PL-pgSQL migrations are environment-sensitive (a `setval` inside a block was fixed with `PERFORM setval(...)`), and tests must not assert an exact migration count.

## Related

- Docs: [`../DEPLOYMENT.md`](../DEPLOYMENT.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- Commits: `aaf7cb8`, `3d2d369`, `fc1326a`
