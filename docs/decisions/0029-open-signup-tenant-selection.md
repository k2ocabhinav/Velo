# 0029 — Open signup tenant selection

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Anonymous signup must assign each new account to a tenant before authentication. The BFF resolves a tenant slug from the incoming host and forwards it to the backend in `X-Velo-Tenant-Slug`. The public API also accepts that header directly, so a caller can choose any active tenant slug.

## Decision

All current tenants intentionally allow open signup. Tenant selection uses the BFF-forwarded `X-Velo-Tenant-Slug`; direct API callers may select any active tenant. Accounts are scoped to their assigned tenant and only access that tenant's data.

## Consequences

- The signup experience stays open without tenant-specific invite flows.
- A caller may choose which active tenant receives a new account, but cannot use that account to access another tenant's data.
- Revisit this decision when a tenant needs invite-only signup; add a tenant signup policy and enforce it in the backend before enabling that tenant's registration flow.
