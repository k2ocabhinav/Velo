variable "aws_region" {
  description = "AWS region for all resources; the ACM certificate must be in this region."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short prefix used for resource names."
  type        = string
  default     = "velo"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging."
  }
}

variable "vpc_cidr" {
  description = "IPv4 range for the VPC. Three /24 subnets are allocated per AZ."
  type        = string
  default     = "10.40.0.0/16"
}

variable "availability_zones" {
  description = "Exactly two AZ names. Leave empty to use the first two available AZs in the region."
  type        = list(string)
  default     = []
  validation {
    condition     = length(var.availability_zones) == 0 || length(var.availability_zones) == 2
    error_message = "Specify either no AZs or exactly two AZs."
  }
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN covering the API and all four frontend hostnames."
  type        = string
}

variable "api_domain_name" {
  description = "Public hostname routed to the backend, for example api.example.com."
  type        = string
}

variable "frontend_domains" {
  description = "Public hostnames for the Next.js standalone applications."
  type = object({
    admin   = string
    rider   = string
    driver  = string
    landing = string
  })
}

variable "jwt_secret" {
  description = "Production JWT signing secret (at least 32 characters). Terraform state contains this value."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "jwt_secret must be at least 32 characters."
  }
}

variable "cors_allowed_origins" {
  description = "Comma-separated exact HTTPS origins for the browser applications."
  type        = string
  sensitive   = true
  validation {
    condition     = alltrue([for origin in split(",", var.cors_allowed_origins) : startswith(trimspace(origin), "https://")])
    error_message = "Every CORS origin must be an explicit HTTPS origin."
  }
}

variable "database_name" {
  description = "Initial PostgreSQL database created by RDS."
  type        = string
  default     = "velo"
}

variable "database_username" {
  description = "RDS master username. RDS stores its generated password in its managed Secrets Manager secret."
  type        = string
  default     = "velo_app"
}

variable "postgres_engine_version" {
  description = "Supported RDS PostgreSQL engine version in the selected region, such as 16.x."
  type        = string
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "backend_image_tag" {
  description = "Tag to deploy from the backend ECR repository."
  type        = string
  default     = "latest"
}

variable "frontend_image_tags" {
  description = "Tags to deploy from each frontend ECR repository."
  type        = map(string)
  default = {
    admin   = "latest"
    rider   = "latest"
    driver  = "latest"
    landing = "latest"
  }
}

variable "backend_desired_count" {
  description = "Desired number of backend Fargate tasks."
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Desired number of tasks per Next.js app."
  type        = number
  default     = 2
}

variable "backend_cpu" {
  description = "Fargate CPU units for the backend task."
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate memory in MiB for the backend task."
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "Fargate CPU units for each frontend task."
  type        = number
  default     = 512
}

variable "frontend_memory" {
  description = "Fargate memory in MiB for each frontend task."
  type        = number
  default     = 1024
}

variable "log_retention_days" {
  description = "CloudWatch log retention for application task logs."
  type        = number
  default     = 30
}
