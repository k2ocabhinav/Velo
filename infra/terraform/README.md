# Velo AWS infrastructure

Terraform provisions the Velo production topology in one AWS region: a two-AZ VPC, public ALB, private ECS Fargate services, private RDS PostgreSQL and Redis, ECR repositories, CloudWatch logs, service discovery, and Secrets Manager values. The RDS PostgreSQL instance has a `postgres16` parameter group with `rds.force_ssl=1`; Flyway migration `V1` creates the PostGIS extension.

The four Next.js apps run as standalone ECS services. They use server rendering and BFF routes for cookie-based auth, so they need Node.js at runtime and cannot be published as static S3 files. The ALB routes the API and each app by hostname and redirects port 80 to HTTPS. ECS tasks live in private subnets; NAT gateways provide outbound access in both AZs. The ALB target group has sticky sessions for the current in-memory STOMP broker.

## Prerequisites

- Terraform 1.6+ and AWS provider 6.x.
- An AWS account and permissions for VPC, ECS, ECR, RDS, ElastiCache, IAM, ACM, Secrets Manager, CloudWatch, and service discovery.
- An ACM certificate in the selected AWS region covering the API and all four app hostnames.
- Four HTTPS frontend origins in `cors_allowed_origins`, plus a JWT signing secret of at least 32 characters.
- A current PostgreSQL 16 engine version supported in the selected region.

Set `aws_region`, `acm_certificate_arn`, `api_domain_name`, `frontend_domains`, `postgres_engine_version`, `jwt_secret`, and `cors_allowed_origins` in an untracked `terraform.tfvars`. Keep the JWT value private.

## Create and deploy

The ECR repositories must exist and contain images before ECS starts tasks. Create only the repositories first:

```sh
terraform init
terraform apply -target=aws_ecr_repository.backend -target='aws_ecr_repository.frontend'
```

Build and push the Spring Boot image and one Next.js image per app from the repository root. Use a versioned tag for each deployment and set `NEXT_PUBLIC_API_BASE_URL` at build time because Next.js inlines public environment variables into browser bundles:

```sh
docker build -t <backend-repository>:<tag> velo-platform
docker build -f velo-frontend/Dockerfile --build-arg APP=admin --build-arg NEXT_PUBLIC_API_BASE_URL=https://<api-host> -t <admin-repository>:<tag> velo-frontend
```

Repeat the frontend command with `APP=rider`, `APP=driver`, and `APP=landing`, then push all five images to ECR. Set `backend_image_tag` and all entries of `frontend_image_tags` to those tags, then run:

```sh
terraform plan -out=tfplan
terraform apply tfplan
```

Create DNS records for `api_domain_name` and all frontend domains pointing to the ALB DNS name from `terraform output alb_dns_name`. Confirm the ACM certificate is issued before applying the HTTPS listener.

## Configuration and operations

- ECS injects `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and `SPRING_DATA_REDIS_HOST` from Secrets Manager. RDS manages the database username/password secret; the other values are versioned by Terraform.
- Automatic rotation of the RDS master secret is disabled because ECS snapshots secret values when tasks start. Rotate it during a planned maintenance, then force a backend ECS deployment so every task reads the current password.
- The backend uses the managed RDS master login for Flyway migrations. Before a stricter least-privilege rollout, provision separate migration and application database roles and inject the runtime role into ECS.
- `SPRING_DATASOURCE_URL` uses `sslmode=require`; the DB parameter group rejects non-TLS PostgreSQL clients. Redis transit encryption is on and the backend enables Redis TLS.
- The task execution role reads only the runtime secrets and writes application logs. Fargate tasks have no public IP. RDS and Redis ingress is restricted to the task security group.
- Terraform state contains the JWT secret and CORS value because the secret versions are managed here. Use an encrypted, access-controlled remote state backend with locking, and restrict plan/state artifacts.
- RDS deletion protection is enabled, backups are retained for seven days, and final snapshots are required. Review instance sizes, NAT gateway cost, backup retention, and desired task counts for the AWS account before applying.
- Terraform does not create DNS records or request ACM certificates. Replace the RDS and task image version inputs when upgrading.
- Do not enable multiple backend tasks until STOMP messaging has a shared broker; ALB stickiness preserves a connection's target but does not deliver events across task instances.

`terraform destroy` is intentionally blocked by RDS deletion protection until an operator reviews and disables it.
