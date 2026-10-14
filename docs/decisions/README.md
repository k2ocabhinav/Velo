# Velo — Decision Ledger

> Append-only record of the architectural decisions behind Velo.

## What Is a Decision Record?

A decision record captures **one significant choice**: the context, the options weighed, what was chosen, and what it costs. It exists so that months later—when someone asks "why is it built this way?"—there is an answer that does not depend on memory.

**Write one when a choice is:**

- costly or slow to reverse (data model, auth, deployment topology), or
- likely to prompt a later "why?" (a convention, a library, an exposure policy).

Small, reversible choices do not need a record.

## Rules

1. **Filename:** `NNNN-kebab-title.md`, next number in sequence.
2. **Append-only.** Never rewrite the substance of an `Accepted` record. Fixing a typo is fine; changing the decision is not.
3. **Superseding:** to change a decision, write a new record and add `Supersedes NNNN` to it. Change the old record's **Status** line to `Superseded by NNNN` and nothing else.
4. **Mistakes are recorded, not deleted.** If a decision was wrong or was reversed, add a record explaining what changed and why.
5. **One decision per record.** Keep each record under ~40 lines.
6. Start from [`0000-template.md`](0000-template.md).
7. **Backfilled records** are marked `Accepted (backfilled)`. They only state reasoning that is actually documented; where no rationale was written down, they say `Rationale not recorded at the time.` instead of inventing one.

## Index

| No. | Title | Status | Date |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-14 |
| [0002](0002-multi-tenant-data-isolation.md) | Multi-tenant data isolation in a shared schema | Accepted (backfilled) | 2026-04-15 |
| [0003](0003-httponly-cookie-bff-auth.md) | httpOnly cookie session with a BFF proxy | Accepted (backfilled) | 2026-04-08 |
| [0004](0004-turborepo-monorepo-shared-ui-package.md) | Turborepo monorepo with a shared UI package | Accepted (backfilled) | 2026-04-07 |
| [0005](0005-apiresponse-envelope.md) | Uniform `ApiResponse` envelope from all controllers | Accepted (backfilled) | 2026-04-07 |
| [0006](0006-flyway-schema-migrations.md) | Flyway migrations with `ddl-auto=validate` | Accepted (backfilled) | 2026-04-10 |
| [0007](0007-semantic-design-tokens-white-label-theming.md) | Semantic design tokens and white-label theming | Accepted (backfilled) | 2026-04-08 |
| [0008](0008-postgis-geospatial-matching.md) | PostGIS geography for geospatial matching | Accepted (backfilled) | 2026-04-07 |
| [0009](0009-aws-ecs-rds-deployment-target.md) | AWS ECS + RDS as the production target | Accepted (backfilled) | 2026-04-08 |
| [0010](0010-stomp-websocket-notifications.md) | STOMP over SockJS for real-time updates | Accepted (backfilled) | 2026-04-07 |
| [0011](0011-owasp-dependency-check-gate.md) | Strict dependency-check gate and profile-gated API docs | Accepted (backfilled) | 2026-04-08 |
| [0012](0012-track-ai-development-process.md) | Track the AI-assisted development process in the repository | Superseded in part by 0015 | 2026-10-14 |
| [0013](0013-demo-seed-data-isolated-from-production.md) | Demo seed data isolated from production | Accepted | 2026-10-14 |
| [0014](0014-payment-per-ride-not-per-user.md) | Payments belong to a ride, not a user | Accepted | 2026-10-14 |
| [0015](0015-track-only-process-metrics.md) | Track only process metrics; keep narratives local | Accepted | 2026-10-14 |
| [0016](0016-websocket-ticket-auth.md) | Short-lived WebSocket tickets instead of browser-held JWTs | Accepted | 2026-10-14 |
| [0017](0017-rider-current-request-recovery.md) | Recover the rider's current request from the backend | Accepted | 2026-10-14 |
| [0018](0018-refresh-token-rotation.md) | Rotating refresh tokens with family revocation | Superseded in part by 0022 | 2026-10-14 |
| [0019](0019-terraform-for-aws-infrastructure.md) | Terraform for AWS infrastructure | Accepted | 2026-10-14 |
| [0020](0020-tenant-theme-loading.md) | Server-side tenant theme loading | Accepted | 2026-10-14 |
| [0021](0021-geocoding-provider.md) | Geocoding through a provider-swappable backend proxy | Accepted | 2026-10-14 |
| [0022](0022-refresh-rotation-grace-window.md) | Refresh rotation grace window | Accepted | 2026-10-14 |
| [0023](0023-recurring-trip-templates.md) | Recurring trip templates materialised ahead | Accepted | 2026-10-15 |

`0000-template.md` is the template and is intentionally not indexed.

## Related

- Progress tracking lives in [`../PROGRESS.md`](../PROGRESS.md).
- The doc index lives in [`../README.md`](../README.md).
