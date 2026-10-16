# 0026 — Tenant tariffs and service areas

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

Velo serves tenants in different currencies and service models. A single global fare formula makes chauffeured airport transfers implausibly cheap for Saffron Routes, while a shared Bengaluru geocoding bias misranks searches for tenants operating elsewhere.

## Options considered

1. **Keep global rates and convert by currency.**
   - Pros: one formula to maintain.
   - Cons: exchange rates cannot represent each tenant's service, minimum charge, or commercial pricing.
2. **Store each tenant's rates and service area.**
   - Pros: quotes, fixture values, and local geocoding follow tenant configuration.
   - Cons: tenant setup must provide or inherit those values.

## Decision

We will store base fare, per-kilometre rate, and minimum fare on `tenant`, as `NUMERIC(12,2)` values in that tenant's currency. Decimal storage keeps fare, payment, earnings, and payout calculations exact to the currency's minor unit; the existing default tenant retains its $5 base and $2/km rate, while Saffron uses ₹250 + ₹35/km with a ₹600 minimum. Tenant service-area centre and radius are also stored on `tenant`; unset values use the geocoding profile's configured fallback.

## Consequences

- Every fare path uses the tenant on its ride request; downstream money records continue to derive from the resulting fare.
- Tenants can tune local search bias independently, while deployments can retain a configured fallback.
- **Risks:** Tariff and currency values must be maintained together when a tenant changes currencies.

## Related

- `docs/decisions/0021-geocoding-provider.md`
- `docs/decisions/0024-demo-fleet-simulator-and-live-dispatch-map.md`
