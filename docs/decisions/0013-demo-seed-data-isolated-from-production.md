# 0013 — Isolate demo seed data and runtime secrets

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The code review found that Flyway V2 creates a known demo admin and user set in every environment, while base configuration supplies a public development JWT key and database credentials. Production must not inherit either demo data or development secrets. The seed migration must retain its original contents and checksum so local databases that already applied V2 continue to validate. See [the security review](../../ai-workflow/reviews/2026-10-14-code-review/security.deepseek-v4.1-flash.md) and [WP1 plan](../../ai-workflow/plans/2026-10-14-review-fixes.md).

## Options considered

1. **Keep the seed in the default Flyway location and remove demo rows during production setup.**
   - Pros: No migration-location changes.
   - Cons: Fresh production databases still receive shared demo credentials.
2. **Move the unchanged seed migration to a demo-only Flyway location and load runtime secrets from the environment outside local/test profiles.**
   - Pros: Fresh production databases do not receive demo accounts; existing V2 checksums remain available in demo-enabled profiles; missing or development-default secrets fail startup.
   - Cons: Profiles that need demo fixtures must explicitly enable the demo migration location.

## Decision

We will move V2 unchanged to `db/demo-migration` and enable that location only for local/dev/test. Production Flyway will use only the application migration location. Non-local profiles will read JWT signing material, database credentials, and allowed browser origins from environment variables; startup validation rejects missing values, known development defaults, and wildcard origins.

## Consequences

- Fresh production databases no longer create the demo users; local/dev/test retain the existing fixtures.
- Operators must provide `JWT_SECRET`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and `CORS_ALLOWED_ORIGINS` outside local/test.
- **Risks:** a prod/staging database that already recorded V2 will see it as a missing migration under the production location and may fail Flyway validation. The documented deployment has not yet been provisioned; verify its schema history before rollout. Deployments must also set all required environment values before startup.

## Related

- Docs: `ai-workflow/reviews/2026-10-14-code-review/security.deepseek-v4.1-flash.md`, `ai-workflow/plans/2026-10-14-review-fixes.md`
