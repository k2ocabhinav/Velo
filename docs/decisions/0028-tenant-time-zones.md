# 0028 — Tenant time zones for scheduled and recurring trips

- **Status:** Accepted
- **Date:** 2026-10-16
- **Supersedes in part:** 0023

## Context

Scheduled and weekly trips were validated, stored and dispatched in UTC while the rider UI submits a `datetime-local` wall clock and no tenant is guaranteed to be in UTC. Saffron Routes (Asia/Kolkata) was therefore off by 5h30m: a 09:00 booking was stored as 09:00 UTC and dispatched at 14:30 local, and the 30-minute advance rule compared a wall clock against UTC. 0023 explicitly recorded that tenant time zones were not modelled yet.

## Options considered

1. **Client sends a wall clock plus the tenant/rider zone; the backend interprets it.**
   - Pros: the wire value matches what the user typed.
   - Cons: every writer must agree on the zone, and the response still needs a zone to render.
2. **Client sends an ISO-8601 instant with offset; the backend stores UTC. Recurring templates keep a local time of day plus an IANA zone.**
   - Pros: unambiguous on the wire, one storage convention, recurring rules stay human-readable.
   - Cons: the API must carry offsets on scheduled timestamps.

## Decision

We will model one IANA `time_zone` per tenant (V15: `UTC` by default, `Asia/Kolkata` for Saffron). A one-off scheduled ride is sent as an ISO-8601 instant with offset and stored as a UTC `LocalDateTime`; validation, storage and dispatch all compare UTC instants. A recurring template stores its local time of day plus the tenant's IANA zone and materialises each occurrence in that zone. Scheduled timestamps returned to clients carry their offset so each viewer's browser renders them in its own zone.

## Consequences

- A 09:00 IST booking is stored and dispatched at the correct instant, and the 30-minute rule is measured against real now.
- The trip sheet groups and labels a day in the tenant's zone.
- **Risks:** other absolute timestamps remain zone-less `LocalDateTime`s; moving them to offset instants is a separate change.

## Related

- Docs: [`0023-recurring-trip-templates.md`](0023-recurring-trip-templates.md)
