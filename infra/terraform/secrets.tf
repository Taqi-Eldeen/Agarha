# Connection strings: owned by Terraform (they change only when the infrastructure does).
resource "aws_secretsmanager_secret" "infra" {
  name                    = "${local.name}/infra"
  recovery_window_in_days = local.prod ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "infra" {
  secret_id = aws_secretsmanager_secret.infra.id
  secret_string = jsonencode({
    DATABASE_URL = "postgres://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/agarha?sslmode=require"
    REDIS_URL    = "rediss://:${random_password.redis_auth.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  })
}

# Third-party keys: created empty, filled out of band (docs/runbooks/secrets.md) and never
# overwritten by Terraform. Sandbox keys outside production.
resource "aws_secretsmanager_secret" "keys" {
  name                    = "${local.name}/keys"
  recovery_window_in_days = local.prod ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "keys" {
  secret_id     = aws_secretsmanager_secret.keys.id
  secret_string = jsonencode({ for k in local.api_secret_keys : k => "" })
  lifecycle {
    ignore_changes = [secret_string]
  }
}

locals {
  api_secrets = concat(
    [for k in ["DATABASE_URL", "REDIS_URL"] : { name = k, valueFrom = "${aws_secretsmanager_secret.infra.arn}:${k}::" }],
    [for k in local.api_secret_keys : { name = k, valueFrom = "${aws_secretsmanager_secret.keys.arn}:${k}::" }],
  )
}
