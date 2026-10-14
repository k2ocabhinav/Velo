resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = local.name }
}

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "velo.internal"
  description = "Private discovery for Velo ECS services"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "backend" {
  name = "backend"
  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}/backend"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "frontend" {
  for_each = local.frontend_domains

  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_iam_role" "task_execution" {
  name = "${local.name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Name = "${local.name}-ecs-execution" }
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "read_runtime_secrets" {
  name = "${local.name}-read-runtime-secrets"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.jwt.arn,
        aws_secretsmanager_secret.cors.arn,
        aws_secretsmanager_secret.datasource_url.arn,
        aws_secretsmanager_secret.redis_host.arn,
        aws_db_instance.main.master_user_secret[0].secret_arn
      ]
    }]
  })
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
    essential = true
    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
      protocol      = "tcp"
    }]
    environment = [
      { name = "SPRING_PROFILES_ACTIVE", value = var.environment },
      { name = "SPRING_DATA_REDIS_PORT", value = "6379" },
      { name = "SPRING_DATA_REDIS_SSL_ENABLED", value = "true" },
      { name = "VELO_PROMETHEUS_ENABLED", value = "false" }
    ]
    secrets = [
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
      { name = "CORS_ALLOWED_ORIGINS", valueFrom = aws_secretsmanager_secret.cors.arn },
      { name = "SPRING_DATASOURCE_URL", valueFrom = aws_secretsmanager_secret.datasource_url.arn },
      { name = "SPRING_DATASOURCE_USERNAME", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:username::" },
      { name = "SPRING_DATASOURCE_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      { name = "SPRING_DATA_REDIS_HOST", valueFrom = aws_secretsmanager_secret.redis_host.arn }
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "curl --fail --silent http://127.0.0.1:8080/actuator/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
  tags = { Name = "${local.name}-backend" }
}

resource "aws_ecs_task_definition" "frontend" {
  for_each = local.frontend_domains

  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${aws_ecr_repository.frontend[each.key].repository_url}:${var.frontend_image_tags[each.key]}"
    essential = true
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]
    environment = [
      { name = "VELO_API_BASE_URL", value = "http://backend.velo.internal:8080" },
      { name = "NEXT_PUBLIC_API_BASE_URL", value = "https://${var.api_domain_name}" },
      { name = "VELO_AUTH_COOKIE_SECURE", value = "true" }
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.frontend[each.key].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
  tags = { Name = "${local.name}-${each.key}" }
}

resource "aws_ecs_service" "backend" {
  name            = "backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  health_check_grace_period_seconds = 90
  network_configuration {
    subnets          = [for subnet in aws_subnet.application : subnet.id]
    security_groups  = [aws_security_group.application.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8080
  }
  service_registries {
    registry_arn = aws_service_discovery_service.backend.arn
  }
  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener_rule.backend,
    aws_iam_role_policy_attachment.task_execution,
    aws_iam_role_policy.read_runtime_secrets,
    aws_secretsmanager_secret_rotation.database_master
  ]
  tags = { Name = "${local.name}-backend" }
}

resource "aws_ecs_service" "frontend" {
  for_each = local.frontend_domains

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend[each.key].arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  health_check_grace_period_seconds = 90
  network_configuration {
    subnets          = [for subnet in aws_subnet.application : subnet.id]
    security_groups  = [aws_security_group.application.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.frontend[each.key].arn
    container_name   = each.key
    container_port   = 3000
  }
  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener_rule.frontend,
    aws_iam_role_policy_attachment.task_execution
  ]
  tags = { Name = "${local.name}-${each.key}" }
}
