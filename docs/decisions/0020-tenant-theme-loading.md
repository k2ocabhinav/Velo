# 0020 — Resolve tenant branding before first paint

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The tenant branding contract in [0007](0007-semantic-design-tokens-white-label-theming.md) requires server-side tenant theme resolution to avoid a flash of platform colors. Branding is public display data, while tenant identity still comes from the request host and the backend resolves the slug to a tenant record.

## Options considered

1. **Load branding in the browser after hydration** — Simple, but the platform theme flashes and the first render can show the wrong brand.
2. **Resolve branding in each app layout and inject bounded CSS on `<html>`** — Adds server work, but renders the tenant theme and context on the first response.

## Decision

Each app resolves a tenant slug from its host (using a configured default for local development), loads public branding in the server layout with Next.js revalidation, and exposes brand identity through a shared context. Only the primary, hover, and foreground color tokens may be overridden, and colors that fail 4.5:1 contrast against white use the platform defaults. The backend caches public branding in Redis with a five-minute TTL and a process-local fallback, evicting both on admin branding updates.

## Consequences

- The first server-rendered response carries the tenant color and identity without a client theme swap.
- The backend remains available if Redis is unavailable; local fallback entries are process-scoped.
- **Risks:** Redis eviction cannot immediately purge Next.js fetch caches on other frontend instances; the 60-second revalidation bounds that stale window.

## Related

- Docs: [0007 semantic design tokens and white-label theming](0007-semantic-design-tokens-white-label-theming.md), [Design System](../DESIGN_SYSTEM.md)
