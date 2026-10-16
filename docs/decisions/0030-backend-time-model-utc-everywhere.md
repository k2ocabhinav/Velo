# 0030 — Backend time model: UTC everywhere

- **Status:** Accepted
- **Date:** 2026-10-17
- **Supersedes in part:** 0023, 0028

## Context

The backend stores most event and lifecycle times as `LocalDateTime` in PostgreSQL `timestamp without time zone` columns. The JVM and PostgreSQL session had inherited the host's local zone, while selected services and `UtcTimes` treated the same values as UTC. This made driver freshness, offer expiry, audit times, and demo schedules disagree on India-time developer machines.

## Options considered

1. **Keep host-local clocks and convert each path independently.**
   - Pros: preserves the current process default.
   - Cons: every writer, JDBC session, and SQL fixture must repeat zone conversions correctly.
2. **Use UTC as the backend's single reference zone.**
   - Pros: one meaning for all zone-less stored times and consistent Hibernate, SQL, and API behavior.
   - Cons: old local-wall-clock rows cannot be distinguished safely from UTC rows.

## Decision

The backend JVM default, Hibernate JDBC time zone, and every PostgreSQL connection session will use UTC. Every backend `LocalDateTime` and `timestamp without time zone` value means UTC; `UtcTimes` converts those values to explicit UTC offsets on instant-based API fields. Tenant zones from 0028 remain in use for interpreting user-entered schedules and rendering tenant calendars. We will not rewrite historical non-fixture rows; local demo startup continues to rebuild its fixtures in UTC.

## Consequences

- Time comparisons and timestamps written from Java or SQL behave the same on India-time developer machines and UTC CI hosts.
- Existing non-fixture rows in local databases created before this change may appear shifted; there is no destructive migration because their original zone cannot be known reliably.
- Tenant-local scheduled and recurring trip behavior remains governed by each tenant's IANA time zone.

## Related

- Decisions: [0023](0023-recurring-trip-templates.md), [0028](0028-tenant-time-zones.md)
- Code: `velo-platform/src/main/java/com/velo/platform/utils/UtcTimes.java`
