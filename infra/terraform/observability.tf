# Alerts (section 10): 5xx > 1%, p95 latency > 800 ms, queue backlog > 5 min, OTP failures > 10%,
# spend. Queue/OTP metrics come from the worker's EMF log lines (apps/api/src/worker/metrics.ts).
resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  for_each  = toset(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

locals {
  alb_dim = { LoadBalancer = aws_lb.main.arn_suffix }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${local.name}-5xx-rate"
  alarm_description   = "More than 1% of requests return 5xx (docs/runbooks/incident.md)"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1
  evaluation_periods  = 3
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  metric_query {
    id          = "rate"
    expression  = "100 * errors / MAX([requests, 1])"
    label       = "5xx %"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      dimensions  = local.alb_dim
      period      = 300
      stat        = "Sum"
    }
  }
  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      dimensions  = local.alb_dim
      period      = 300
      stat        = "Sum"
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "p95_latency" {
  alarm_name          = "${local.name}-p95-latency"
  alarm_description   = "p95 target response time above 800 ms"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  dimensions          = local.alb_dim
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 3
  threshold           = 0.8
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "queue_backlog" {
  alarm_name          = "${local.name}-queue-backlog"
  alarm_description   = "Oldest waiting job older than 5 minutes (worker down or overloaded)"
  namespace           = "Agarha"
  metric_name         = "QueueOldestWaitSeconds"
  dimensions          = { Environment = var.environment }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 300
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"
}

resource "aws_cloudwatch_metric_alarm" "otp_failures" {
  alarm_name          = "${local.name}-otp-failures"
  alarm_description   = "OTP send failures above 10% over 15 minutes (docs/runbooks/otp-outage.md)"
  namespace           = "Agarha"
  metric_name         = "OtpFailurePercent"
  dimensions          = { Environment = var.environment }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${local.name}-db-free-storage"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }
}

# Uptime: Route 53 health checks on the public site and API health from several regions.
resource "aws_route53_health_check" "uptime" {
  for_each          = { web = local.hosts.web, api = local.hosts.api }
  fqdn              = each.value
  type              = "HTTPS"
  port              = 443
  resource_path     = each.key == "api" ? "/v1/health" : "/api/health"
  request_interval  = 30
  failure_threshold = 3
  regions           = ["eu-west-1", "us-east-1", "ap-southeast-1"]
}

resource "aws_cloudwatch_metric_alarm" "uptime" {
  for_each            = aws_route53_health_check.uptime
  provider            = aws
  alarm_name          = "${local.name}-${each.key}-down"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = each.value.id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
