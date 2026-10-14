# 0009 — AWS ECS + RDS as the production target

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-08

## Context

Velo needs a production hosting plan that supports real users, a multi-tenant future, and independent scaling—while keeping a cheap path for early development and demos.

## Options considered

1. **Budget PaaS: Vercel + Railway/Render (~$5–10/mo)** — Pros: fastest to stand up, managed PostgreSQL and Redis included. Cons: less control; a weaker fit for long-term scaling.
2. **AWS: ECS Fargate + RDS PostgreSQL (PostGIS) + ElastiCache + S3/CloudFront (~$45–65/mo)** — Pros: documented as "best for: real users, multi-tenant future, scaling", with a managed service per layer. Cons: more setup and higher cost.

## Decision

Target AWS for production: Route 53 → CloudFront/S3 (frontend static hosting) and ALB → ECS Fargate (Spring Boot) → RDS PostgreSQL with PostGIS + ElastiCache Redis, with secrets in Secrets Manager. Keep the Railway/Render option as the budget path for early development and demos. Production runs `ddl-auto=validate` and `sql.init.mode=never`.

## Consequences

- A clear production topology and cost envelope; each layer scales independently.
- **Risks:** STOMP WebSocket delivery across multiple ECS tasks needs ALB sticky sessions and, at scale, Redis pub/sub for cross-instance delivery. This topology is a target, not yet provisioned.

## Related

- Docs: [`../DEPLOYMENT.md`](../DEPLOYMENT.md)
- Commits: `09c0a99`
