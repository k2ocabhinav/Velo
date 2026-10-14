# 0007 — Semantic design tokens and white-label theming

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-08

## Context

Velo renders under tenant brands. If components used raw colors and sizes, every brand change would mean touching components, and tenants could break the platform's layout and accessibility. Brand had to become a bounded override layer over a fixed platform.

## Options considered

1. **Raw colors/values inside components** — Pros: fastest to write. Cons: no theming path; brand changes ripple through every component.
2. **A single flat theme object** — Pros: one source of values. Cons: no separation between brand-owned and platform-owned values, so tenants can break layout and accessibility.
3. **Three-layer tokens (primitives → semantics → component) with a narrow tenant override surface** — Pros: components reference semantic tokens only; tenants change a bounded set. Documented rationale: "Brand is a skin, not a surgery." Cons: more upfront token authoring.

## Decision

Components reference semantic tokens only, never primitive or raw values. Tenants may configure primary/accent color, logo, display/body fonts, border-radius, and dark mode—and cannot change layout, spacing, motion, typography scale, or accessibility behavior. Tenant themes are resolved server-side (middleware → Redis cache → inline CSS) so there is no flash of unstyled content.

## Consequences

- One token layer to change for branding; platform UX guarantees hold across every tenant.
- Theme is injected at SSR, which avoids hydration mismatch.
- **Risks:** stale tenant theme cache (mitigated by a Redis TTL); fonts must preload to avoid FOUT.

## Related

- Docs: [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md), [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md)
- Commits: `ade9900`, `7810dd7`
