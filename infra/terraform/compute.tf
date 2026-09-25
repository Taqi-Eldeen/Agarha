# Containers on ECS Fargate: API (min 2, autoscaled), worker, web, admin; migrations as a one-off task
# run by CI before each deploy (expand → deploy → contract, docs/runbooks/database.md).
locals {
  services = {
    api    = { port = 4000, cpu = 512, memory = 1024, health = "/v1/health", command = null }
    worker = { port = null, cpu = 512, memory = 1024, health = null, command = null }
    web    = { port = 3000, cpu = 512, memory = 1024, health = "/api/health", command = null }
    admin  = { port = 3001, cpu = 256, memory = 512, health = "/api/health", command = null }
  }
  images = ["api", "worker", "migrate", "web", "admin"]

  api_env = {
    NODE_ENV                    = "production"
    APP_ENV                     = var.environment
    PORT                        = "4000"
    LOG_LEVEL                   = "info"
    CORS_ORIGINS                = "https://${local.hosts.web},https://${local.hosts.admin}"
    COOKIE_DOMAIN               = ".${var.domain}"
    COOKIE_SECURE               = "true"
    TRUST_PROXY_HOPS            = "2"
    API_PUBLIC_URL              = "https://${local.hosts.api}"
    PUBLIC_WEB_URL              = "https://${local.hosts.web}"
    SMS_PROVIDERS               = "twilio,vonage"
    WHATSAPP_PROVIDER           = "meta"
    WHATSAPP_OTP_ENABLED        = "true"
    PUSH_PROVIDER               = "expo"
    EMAIL_PROVIDER              = "resend"
    STORAGE_DRIVER              = "s3"
    STORAGE_ENDPOINT            = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
    STORAGE_REGION              = "auto"
    STORAGE_PUBLIC_BUCKET       = cloudflare_r2_bucket.public_media.name
    STORAGE_PRIVATE_BUCKET      = cloudflare_r2_bucket.private_docs.name
    MEDIA_PUBLIC_BASE_URL       = "https://${local.hosts.media}"
    MAPS_PROVIDER               = "google"
    PAYMENT_GATEWAY             = "paymob"
    ADMIN_IP_ALLOWLIST          = join(",", var.admin_ip_allowlist)
    ADMIN_DEV_LOGIN             = "false"
    OTEL_EXPORTER_OTLP_ENDPOINT = ""
  }
}

resource "aws_ecr_repository" "app" {
  for_each             = toset(local.images)
  name                 = "agarha/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name
  policy     = jsonencode({ rules = [{ rulePriority = 1, description = "keep 50 images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 50 }, action = { type = "expire" } }] })
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- IAM: execution role pulls images, reads secrets, writes logs. Tasks need no AWS API access. ---
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.infra.arn, aws_secretsmanager_secret.keys.arn] }]
  })
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_cloudwatch_log_group" "app" {
  for_each          = toset(local.images)
  name              = "/agarha/${var.environment}/${each.key}"
  retention_in_days = local.prod ? 90 : 14
}

resource "aws_ecs_task_definition" "app" {
  for_each                 = toset(local.images)
  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = try(local.services[each.key].cpu, 256)
  memory                   = try(local.services[each.key].memory, 512)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  container_definitions = jsonencode([{
    name                   = each.key
    image                  = "${aws_ecr_repository.app[each.key].repository_url}:${var.image_tag}"
    essential              = true
    portMappings           = try(local.services[each.key].port, null) == null ? [] : [{ containerPort = local.services[each.key].port, protocol = "tcp" }]
    environment            = [for k, v in(contains(["web", "admin"], each.key) ? { NODE_ENV = "production", API_INTERNAL_URL = "https://${local.hosts.api}" } : local.api_env) : { name = k, value = v }]
    secrets                = contains(["web", "admin"], each.key) ? [] : local.api_secrets
    readonlyRootFilesystem = contains(["api", "worker", "migrate"], each.key)
    stopTimeout            = each.key == "worker" ? 120 : 30
    logConfiguration = {
      logDriver = "awslogs"
      options   = { awslogs-group = aws_cloudwatch_log_group.app[each.key].name, awslogs-region = var.aws_region, awslogs-stream-prefix = each.key }
    }
  }])
}

# --- Load balancer (Cloudflare → ALB → tasks) ------------------------------------------------------
resource "aws_lb" "main" {
  name                       = local.name
  load_balancer_type         = "application"
  subnets                    = module.vpc.public_subnets
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true
  enable_deletion_protection = local.prod
}

resource "aws_acm_certificate" "main" {
  domain_name               = local.hosts.web
  subject_alternative_names = [local.hosts.api, local.hosts.admin]
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in cloudflare_dns_record.acm_validation : r.name]
}

resource "aws_lb_target_group" "app" {
  for_each             = { for k, v in local.services : k => v if v.port != null }
  name                 = "${local.name}-${each.key}"
  port                 = each.value.port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = module.vpc.vpc_id
  deregistration_delay = 30
  health_check {
    path                = each.value.health
    matcher             = "200-399"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["web"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  condition {
    host_header { values = [local.hosts.api] }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["api"].arn
  }
}

# Admin console: the IP allowlist is enforced at Cloudflare (edge.tf: the ALB only sees Cloudflare
# IPs) and again by the API on /v1/admin* (ADMIN_IP_ALLOWLIST; client IP via TRUST_PROXY_HOPS=2).
resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20
  condition {
    host_header { values = [local.hosts.admin] }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["admin"].arn
  }
}

# --- Services: rolling deploys with health checks and automatic rollback (circuit breaker) -------
resource "aws_ecs_service" "app" {
  for_each                           = local.services
  name                               = each.key
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.app[each.key].arn
  desired_count                      = each.key == "api" ? var.api_min_instances : (local.prod && each.key == "web" ? 2 : 1)
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = each.value.port == null ? null : 30
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.tasks.id]
  }
  dynamic "load_balancer" {
    for_each = each.value.port == null ? [] : [1]
    content {
      target_group_arn = aws_lb_target_group.app[each.key].arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }
  lifecycle {
    ignore_changes = [desired_count]
  }
}

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app["api"].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_min_instances
  max_capacity       = var.api_max_instances
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
