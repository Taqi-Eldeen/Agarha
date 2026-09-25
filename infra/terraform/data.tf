# PostgreSQL 16 + PostGIS/pg_trgm (extensions created by the first migration). Encrypted at rest,
# automated backups with point-in-time recovery (RPO 1h), deletion protection in production.
resource "aws_db_parameter_group" "pg" {
  name   = "${local.name}-pg16"
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
}

# Generated here so Terraform can compose DATABASE_URL into Secrets Manager. State is encrypted and
# access-restricted (envs/*.backend.hcl); rotate via docs/runbooks/database.md.
resource "random_password" "db" {
  length  = 40
  special = false
}

resource "aws_db_instance" "main" {
  identifier                      = local.name
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.db_instance_class
  allocated_storage               = 50
  max_allocated_storage           = 500
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "agarha"
  username                        = "agarha_owner"
  password                        = random_password.db.result
  multi_az                        = var.db_multi_az
  db_subnet_group_name            = module.vpc.database_subnet_group_name
  vpc_security_group_ids          = [aws_security_group.data.id]
  parameter_group_name            = aws_db_parameter_group.pg.name
  backup_retention_period         = local.prod ? 14 : 3
  backup_window                   = "01:00-02:00"
  maintenance_window              = "Fri:02:30-Fri:03:30"
  deletion_protection             = local.prod
  skip_final_snapshot             = !local.prod
  final_snapshot_identifier       = local.prod ? "${local.name}-final" : null
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  auto_minor_version_upgrade      = true
  copy_tags_to_snapshot           = true
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name}-redis"
  subnet_ids = module.vpc.private_subnets
}

# BullMQ needs noeviction; persistence via snapshots, TLS + AUTH in transit.
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.name}-redis7"
  family = "redis7"
  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}

resource "random_password" "redis_auth" {
  length  = 48
  special = false
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = local.name
  description                = "Agarha cache, queues and rate limits"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = local.prod ? 2 : 1
  automatic_failover_enabled = local.prod
  multi_az_enabled           = local.prod
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result
  snapshot_retention_limit   = local.prod ? 7 : 1
}
