environment        = "staging"
aws_region         = "eu-central-1"
domain             = "agarha.com"
api_min_instances  = 2
api_max_instances  = 3
db_instance_class  = "db.t4g.medium"
db_multi_az        = false
redis_node_type    = "cache.t4g.small"
monthly_budget_usd = 400
# Set in CI from secrets: cloudflare_api_token, cloudflare_account_id, cloudflare_zone_id,
# admin_ip_allowlist, alert_emails, image_tag (TF_VAR_* environment variables).
