# terraform test: plans against mock providers (no cloud credentials) and checks the guarantees the
# spec asks for. CI runs this on every infra change.
mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["eu-central-1a", "eu-central-1b", "eu-central-1c"] }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = { arn = "arn:aws:acm:eu-central-1:123456789012:certificate/test" }
  }
  mock_resource "aws_lb" {
    defaults = { arn = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:loadbalancer/app/test/abc", arn_suffix = "app/test/abc", dns_name = "test.eu-central-1.elb.amazonaws.com" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/test" }
  }
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:eu-central-1:123456789012:test" }
  }
  mock_resource "aws_lb_target_group" {
    defaults = { arn = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:targetgroup/test/abc" }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:listener/app/test/abc/def" }
  }
  mock_resource "aws_ecs_task_definition" {
    defaults = { arn = "arn:aws:ecs:eu-central-1:123456789012:task-definition/test:1" }
  }
  mock_resource "aws_ecs_cluster" {
    defaults = { id = "arn:aws:ecs:eu-central-1:123456789012:cluster/test" }
  }
}

mock_provider "cloudflare" {
  mock_data "cloudflare_ip_ranges" {
    defaults = { ipv4_cidrs = ["173.245.48.0/20", "103.21.244.0/22"] }
  }
}

mock_provider "random" {}

variables {
  environment           = "production"
  image_tag             = "0123abc"
  cloudflare_api_token  = "test"
  cloudflare_account_id = "0123456789abcdef0123456789abcdef"
  cloudflare_zone_id    = "fedcba9876543210fedcba9876543210"
  admin_ip_allowlist    = ["198.51.100.10/32"]
}

run "production_guarantees" {
  command = plan

  assert {
    condition     = aws_ecs_service.app["api"].desired_count >= 2 && aws_appautoscaling_target.api.min_capacity >= 2
    error_message = "API must run at least 2 instances."
  }
  assert {
    condition     = aws_ecs_service.app["api"].deployment_circuit_breaker[0].rollback
    error_message = "Rolling deploys must roll back automatically on failed health checks."
  }
  assert {
    condition     = aws_db_instance.main.storage_encrypted && aws_db_instance.main.deletion_protection && aws_db_instance.main.multi_az && aws_db_instance.main.backup_retention_period >= 7
    error_message = "Production database must be encrypted, protected, multi-AZ and backed up."
  }
  assert {
    condition     = aws_elasticache_replication_group.redis.at_rest_encryption_enabled && aws_elasticache_replication_group.redis.transit_encryption_enabled
    error_message = "Redis must be encrypted at rest and in transit."
  }
  assert {
    condition     = alltrue([for r in aws_ecr_repository.app : r.image_tag_mutability == "IMMUTABLE"])
    error_message = "Images are tagged by commit SHA and immutable."
  }
  assert {
    condition     = alltrue([for i in aws_security_group.alb.ingress : i.from_port == 443 && toset(i.cidr_blocks) == toset(["173.245.48.0/20", "103.21.244.0/22"])])
    error_message = "Only Cloudflare may reach the load balancer, on 443."
  }
  assert {
    condition     = strcontains(cloudflare_ruleset.firewall.rules[0].expression, "198.51.100.10/32")
    error_message = "The admin allowlist must be enforced at the edge."
  }
  assert {
    condition     = cloudflare_zone_setting.min_tls.value == "1.2"
    error_message = "TLS 1.2+ only."
  }
  assert {
    condition     = local.hosts.api == "api.agarha.com" && local.hosts.admin == "admin.agarha.com"
    error_message = "Production hostnames."
  }
}

run "staging_is_cheaper_but_still_two_api_instances" {
  command = plan
  variables {
    environment = "staging"
    db_multi_az = false
  }
  assert {
    condition     = !aws_db_instance.main.deletion_protection && local.hosts.api == "api.staging.agarha.com"
    error_message = "Staging settings."
  }
  assert {
    condition     = aws_ecs_service.app["api"].desired_count >= 2
    error_message = "Staging also runs 2 API instances (production-like)."
  }
}

run "rejects_a_single_api_instance" {
  command = plan
  variables {
    api_min_instances = 1
  }
  expect_failures = [var.api_min_instances]
}
