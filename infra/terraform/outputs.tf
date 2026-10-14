output "alb_dns_name" {
  description = "ALB DNS name. Point api_domain_name and frontend_domains at this name using DNS records."
  value       = aws_lb.main.dns_name
}

output "api_url" {
  description = "Public API URL."
  value       = "https://${var.api_domain_name}"
}

output "frontend_urls" {
  description = "Public URLs for the four Next.js applications."
  value       = { for app, domain in local.frontend_domains : app => "https://${domain}" }
}

output "backend_ecr_repository_url" {
  description = "ECR repository URI for the Spring Boot backend."
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_ecr_repository_urls" {
  description = "ECR repository URIs for the Next.js applications."
  value       = { for app, repository in aws_ecr_repository.frontend : app => repository.repository_url }
}

output "database_endpoint" {
  description = "Private RDS PostgreSQL endpoint. V1 migration creates the PostGIS extension."
  value       = aws_db_instance.main.address
}

output "redis_endpoint" {
  description = "Private ElastiCache Redis primary endpoint."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "database_master_secret_arn" {
  description = "RDS-managed Secrets Manager secret injected as datasource username/password."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "backend_jwt_secret_arn" {
  description = "Secrets Manager ARN for JWT_SECRET."
  value       = aws_secretsmanager_secret.jwt.arn
}

output "backend_cors_secret_arn" {
  description = "Secrets Manager ARN for CORS_ALLOWED_ORIGINS."
  value       = aws_secretsmanager_secret.cors.arn
}
