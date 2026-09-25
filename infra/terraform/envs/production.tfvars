environment        = "production"
aws_region         = "eu-central-1"
domain             = "agarha.com"
api_min_instances  = 2
api_max_instances  = 8
db_instance_class  = "db.m7g.large"
db_multi_az        = true
redis_node_type    = "cache.m7g.large"
monthly_budget_usd = 1500
# Set in CI from secrets: cloudflare_api_token, cloudflare_account_id, cloudflare_zone_id,
# admin_ip_allowlist, alert_emails, image_tag (TF_VAR_* environment variables).
