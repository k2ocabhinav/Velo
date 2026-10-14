# 0002 — Multi-tenant data isolation in a shared schema

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-15

## Context

Velo is a white-label dispatch platform: each customer (tenant) gets its own drivers, riders, fare rules, and admin surface while running on the same engine ([`PRODUCT_VISION.md`](../PRODUCT_VISION.md), documented 2026-04-08). Isolation therefore has to be correct by default but cheap to operate across many small tenants.

## Options considered

1. **Shared schema with a `tenant_id` column** — Pros: one migration path, one database to operate, simple per-tenant queries. Cons: a query that forgets the filter can leak data across tenants.
2. **Schema-per-tenant** — Pros: stronger structural isolation. Cons: migrations fan out across schemas; heavier ops.
3. **Database-per-tenant** — Pros: strongest isolation. Cons: highest cost and ops for many small tenants.

Options 2 and 3 are noted as future scaling paths in [`DEPLOYMENT.md`](../DEPLOYMENT.md) ("consider RDS per-tenant or schema-per-tenant"); no comparative rationale for the initial choice was written down.

## Decision

Use one shared schema with a `tenant_id` column on tenant-owned entities, tenant-scoped repository lookups (e.g. `findByUserIdAndTenantId`), and the isolation changes carried in Flyway `V3__tenant_branding_and_isolation.sql`. A tenant defaulting fallback is applied at the entity persist boundary so legacy rows and test setup remain valid.

## Consequences

- One schema and one migration set to maintain; per-query tenant filtering is the isolation boundary.
- **Risks:** any query missing the tenant filter crosses tenants; schema/database-per-tenant isolation stays available if a tenant outgrows the shared schema.

## Related

- Docs: [`../PRODUCT_VISION.md`](../PRODUCT_VISION.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md)
- Commits: `7810dd7`
