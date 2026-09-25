# Customer-managed key for secrets and application logs (rotation on, account-scoped policy).
resource "aws_kms_key" "data" {
  description         = "${local.name} secrets and logs"
  enable_key_rotation = true
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Account", Effect = "Allow", Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }, Action = "kms:*", Resource = "*" },
      {
        Sid       = "CloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
        Condition = { ArnLike = { "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/agarha/${var.environment}/*" } }
      },
    ]
  })
}

# Connection strings: owned by Terraform (they change only when the infrastructure does).
resource "aws_secretsmanager_secret" "infra" {
  name                    = "${local.name}/infra"
  kms_key_id              = aws_kms_key.data.arn
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
  kms_key_id              = aws_kms_key.data.arn
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
