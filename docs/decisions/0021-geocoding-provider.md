# 0021 — Proxy submitted address searches through a replaceable geocoder

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Admin dispatch and rider booking need address search and reverse lookup. Browser calls to a provider expose provider details and couple app security policy to provider origins. The public Nominatim service prohibits autocomplete and asks applications to proxy, identify, cache, and rate-limit requests. Velo therefore submits a search only after the user presses Enter or Search; typing alone never calls a provider.

## Options considered

1. **Call a provider from each browser.**
   - Pros: less backend work.
   - Cons: leaks provider details and makes provider changes/CSP updates app-specific.
2. **Proxy through a provider adapter.**
   - Pros: same-origin browser requests, centralized limits and cache, provider can change without frontend changes.
   - Cons: adds backend operations and requires a configured provider endpoint.

## Decision

We will proxy search and reverse requests through the backend `GeocodingService`, using the Nominatim JSON API shape and normalized Velo results. The `local` profile defaults to `https://nominatim.openstreetmap.org` for low-volume, submitted searches and requires `GEOCODING_EMAIL`; it identifies the app with a descriptive configurable User-Agent. Staging and production require an explicit `GEOCODING_BASE_URL` so public Nominatim is not selected accidentally. These profiles should use an operator-managed or commercial compatible provider.

Search suggestions appear only after submission. Rider saved places are stored per authenticated user and tenant. Admin dispatch may offer pickup and drop-off coordinates from that tenant's 20 most recent trips. Provider calls are limited to one per second per instance and cached for 24 hours in Redis with an in-memory fallback.

## Consequences

- Frontends use authenticated same-origin BFF routes; provider changes do not require UI changes.
- A provider must support Nominatim-compatible `/search` and `/reverse` responses, or a new `GeocodingService` adapter must translate its API.
- The operator supplies a monitored contact email for local use and configures provider endpoints and terms for deployed profiles. Provider outages return 503; map selection and manual coordinates remain available.
- **Risks:** The local profile calls public Nominatim and is subject to its usage policy, including one request per second per application. The in-process limiter is per instance, so a deployment with multiple instances must use a shared limiter before using any provider with an application-wide quota. Public Nominatim must not be used for autocomplete or production traffic.

## Related

- Docs: `docs/ARCHITECTURE.md`
