# 0014 — Payment per ride, not per user

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The baseline schema made `payment.user_id` unique and `Payment.user` one-to-one. Since a rider can complete many rides, creating payment for a second ride violated the database constraint and failed the ride flow. Payments are already associated with an individual ride.

## Options considered

1. **Keep one payment per user.**
   - Pros: preserves the existing cardinality.
   - Cons: prevents repeat paid rides.
2. **Allow many payments per user while keeping one payment per ride.**
   - Pros: matches payment lifecycle and existing ride association.
   - Cons: requires a forward migration and entity mapping change.

## Decision

We will allow many payments per user and retain the one-to-one payment-to-ride association. Migration V6 drops the unique constraint from `payment.user_id`.

## Consequences

- A rider can pay for multiple rides.
- Payment history queries must treat a user as having multiple payment rows.
- **Risks:** Existing payment data remains associated with its user and ride; the migration only removes the uniqueness restriction.

## Related

- Code: `velo-platform/src/main/java/com/velo/platform/entities/Payment.java`
- Migration: `velo-platform/src/main/resources/db/migration/V6__payment_per_ride_and_tenant_scoped_promos.sql`
