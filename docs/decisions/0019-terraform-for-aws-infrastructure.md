# 0019 — Terraform for AWS production infrastructure

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Velo's accepted production target is AWS ECS Fargate with RDS PostgreSQL/PostGIS, Redis, and Secrets Manager (decision 0009). The Next.js applications use server rendering and BFF routes, and the repository already builds standalone Node servers; static S3 hosting cannot serve those runtime routes.

## Options considered

1. **Manual AWS configuration** — Pros: quick initial setup. Cons: difficult to reproduce and review.
2. **Terraform-managed VPC, ECS, data stores, ALB, ECR, and secrets** — Pros: reviewable, repeatable infrastructure and consistent staging/production. Cons: Terraform state and provider upgrades need operational care.

## Decision

We will define the AWS topology in `infra/terraform` and run all four Next.js standalone applications as ECS services behind ALB host routing. The apps need server execution for rendering and BFF auth routes; S3/CloudFront remains suitable only for a future static frontend.

## Consequences

- Infrastructure changes can be planned and reviewed before an operator applies them.
- An ACM certificate, DNS records, image publishing, and a protected Terraform state backend remain operator responsibilities.
- **Risks:** Terraform-managed secret versions appear in state; RDS credential rotation must be coordinated with an ECS deployment; multi-task STOMP delivery still needs a shared messaging layer.

## Related

- Docs: [`0009-aws-ecs-rds-deployment-target.md`](0009-aws-ecs-rds-deployment-target.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md), [`../../infra/terraform/README.md`](../../infra/terraform/README.md)
