resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer.id]
  subnets            = [for subnet in aws_subnet.public : subnet.id]
  idle_timeout       = 300
  tags               = { Name = "${local.name}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.name}-api"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/actuator/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  stickiness {
    enabled         = true
    type            = "lb_cookie"
    cookie_duration = 86400
  }
  tags = { Name = "${local.name}-api" }
}

resource "aws_lb_target_group" "frontend" {
  for_each = local.frontend_domains

  name        = "${local.name}-${each.key}"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = { Name = "${local.name}-${each.key}" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Unknown Velo host"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    host_header {
      values = [var.api_domain_name]
    }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_lb_listener_rule" "frontend" {
  for_each = local.frontend_domains

  listener_arn = aws_lb_listener.https.arn
  priority     = 20 + index(["admin", "rider", "driver", "landing"], each.key)

  condition {
    host_header {
      values = [each.value]
    }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend[each.key].arn
  }
}
