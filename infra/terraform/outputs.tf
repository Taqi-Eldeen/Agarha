output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "migrate_task_definition" {
  description = "Run before each deploy: aws ecs run-task --task-definition <this> ..."
  value       = aws_ecs_task_definition.app["migrate"].arn
}

output "private_subnets" {
  value = module.vpc.private_subnets
}

output "tasks_security_group" {
  value = aws_security_group.tasks.id
}

output "hosts" {
  value = local.hosts
}

output "turnstile_site_key" {
  value = cloudflare_turnstile_widget.otp.sitekey
}

output "secrets" {
  value = { infra = aws_secretsmanager_secret.infra.name, keys = aws_secretsmanager_secret.keys.name }
}

# Used by scripts/ci/preview.sh (staging) to attach per-PR services.
output "https_listener_arn" {
  value = aws_lb_listener.https.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
