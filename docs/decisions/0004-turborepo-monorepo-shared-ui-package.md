# 0004 — Turborepo monorepo with a shared UI package

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-07

## Context

Three frontends (admin, rider, driver) plus a landing page share an API client, TypeScript types, and UI components. Duplicating those across separate repos would let them drift. For a white-label product, the shared UI package is also where theming and component ownership live.

## Options considered

1. **Separate repository per app** — Pros: independent release cadence. Cons: duplicated API client, types, and UI; coordination overhead.
2. **One Next.js app with role-based areas** — Pros: a single build. Cons: couples admin/rider/driver deploys and route surfaces.
3. **Turborepo monorepo with shared packages** — Pros: one repo, shared `api`/`ui`/`ws`/`config`, per-app deploys. Documented rationale: "Three apps (admin, rider, driver) share an API client, TypeScript types, and UI components from one repo." Cons: needs workspace tooling and a one-way dependency rule.
4. **Import a component library (Material-UI / Ant Design)** — rejected. Documented rationale: copied-in shadcn/ui components give full ownership and no design lock-in, which is "critical for white-label theming."

## Decision

Use a Turborepo monorepo: apps under `velo-frontend/apps/*` and shared packages under `velo-frontend/packages/*`. Dependencies flow one direction—`packages/` may be imported by apps, and `packages/ui` never imports from any app.

## Consequences

- One home for types, API contracts, and UI; the apps stay thin.
- Workspace tooling and cross-package builds must be maintained.
- **Risks:** the one-way dependency rule must be enforced, or packages quietly become app-coupled.

## Related

- Docs: [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md), [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)
- Commits: `8480ea9`, `ea224fe`, `2bb87ed`
