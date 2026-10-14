resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = [for subnet in aws_subnet.data : subnet.id]
  tags       = { Name = "${local.name}-db" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-cache"
  subnet_ids = [for subnet in aws_subnet.data : subnet.id]
}

resource "aws_security_group" "load_balancer" {
  name        = "${local.name}-alb"
  description = "Public HTTPS entry point"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-alb" }
}

resource "aws_security_group" "application" {
  name        = "${local.name}-tasks"
  description = "Fargate task traffic from the ALB and Velo services"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Backend traffic from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }
  ingress {
    description = "Backend service discovery traffic from Velo tasks"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    self        = true
  }
  ingress {
    description     = "Next.js traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-tasks" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-postgres"
  description = "PostgreSQL is reachable only from Velo tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-postgres" }
}

resource "aws_security_group" "cache" {
  name        = "${local.name}-redis"
  description = "Redis is reachable only from Velo tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-redis" }
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-postgres16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }
  tags = { Name = "${local.name}-postgres16" }
}

resource "aws_db_instance" "main" {
  identifier                  = "${local.name}-postgres"
  engine                      = "postgres"
  engine_version              = var.postgres_engine_version
  instance_class              = var.db_instance_class
  db_name                     = var.database_name
  username                    = var.database_username
  manage_master_user_password = true
  port                        = 5432

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az                   = true
  publicly_accessible        = false
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.database.id]
  parameter_group_name       = aws_db_parameter_group.main.name
  auto_minor_version_upgrade = true
  backup_retention_period    = 7
  copy_tags_to_snapshot      = true
  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${local.name}-postgres-final"
  apply_immediately          = false

  tags = { Name = "${local.name}-postgres" }
}

resource "aws_secretsmanager_secret_rotation" "database_master" {
  secret_id        = aws_db_instance.main.master_user_secret[0].secret_arn
  rotation_enabled = false
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name}-redis"
  description                = "Velo production Redis cache"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  port                       = 6379
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.cache.id]
  apply_immediately          = false

  tags = { Name = "${local.name}-redis" }
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${local.name}/backend/JWT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "cors" {
  name                    = "${local.name}/backend/CORS_ALLOWED_ORIGINS"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "cors" {
  secret_id     = aws_secretsmanager_secret.cors.id
  secret_string = var.cors_allowed_origins
}

resource "aws_secretsmanager_secret" "datasource_url" {
  name                    = "${local.name}/backend/SPRING_DATASOURCE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "datasource_url" {
  secret_id     = aws_secretsmanager_secret.datasource_url.id
  secret_string = "jdbc:postgresql://${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.database_name}?sslmode=require"
}

resource "aws_secretsmanager_secret" "redis_host" {
  name                    = "${local.name}/backend/SPRING_DATA_REDIS_HOST"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "redis_host" {
  secret_id     = aws_secretsmanager_secret.redis_host.id
  secret_string = aws_elasticache_replication_group.main.primary_endpoint_address
}
