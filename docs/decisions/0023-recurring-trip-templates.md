# 0023 — Materialize recurring trips into scheduled ride requests

- **Status:** Superseded in part by 0028
- **Date:** 2026-10-15

## Context

Small fleets need weekly business and hotel transfers to appear in the existing trip queue without adding a second dispatch path. A recurrence also needs to be safe to retry and editable without rewriting trips already in dispatch. The current dispatch service accepts `RideRequest` rows in `SCHEDULED` status.

## Options considered

1. **Keep recurrence rules and dispatch directly from them.**
   - Pros: no generated rows.
   - Cons: duplicates the scheduled dispatch flow and complicates trip-level changes.
2. **Store a tenant-owned template and materialize dated `RideRequest` rows.**
   - Pros: generated trips use the existing dispatcher and each trip remains independently auditable.
   - Cons: template edits must reconcile rows that have not entered dispatch.

## Decision

Store weekly templates separately and materialize each template/date into a tenant-owned `RideRequest`. A unique `(recurring_template_id, occurrence_date)` constraint makes retries safe. Editing a template updates or cancels only future rows still in `SCHEDULED`; existing bookings remain concrete trips when a template is paused or deleted.

## Consequences

- Scheduled dispatch, assignment, and trip-sheet reporting use concrete ride requests.
- Pausing or deleting a template stops future materialization while preserving already-created bookings.
- Times follow the platform's current `LocalDateTime` scheduling convention; tenant-specific time zones are not modeled yet.
- **Risks:** materialized trips use the platform's current UTC scheduler convention until tenant time zones are configured.

## Related

- Docs: [`../SWAGGER.md`](../SWAGGER.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
