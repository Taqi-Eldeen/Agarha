variable "environment" {
  description = "staging | production (preview environments reuse staging with a per-PR database)."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "aws_region" {
  # ADR-0010: hosting region is still open (EU vs Middle East, after a Cairo latency test and legal
  # advice on PDPL cross-border transfer). Frankfurt is the default; me-central-1 (UAE) is a drop-in.
  description = "AWS region for compute, database and cache."
  type        = string
  default     = "eu-central-1"
}

variable "domain" {
  description = "Apex domain managed in Cloudflare."
  type        = string
  default     = "agarha.com"
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "image_tag" {
  description = "Container image tag (git commit SHA) deployed by CI."
  type        = string
}

variable "api_min_instances" {
  description = "Minimum API tasks (spec: at least 2, rolling deploys)."
  type        = number
  default     = 2
  validation {
    condition     = var.api_min_instances >= 2
    error_message = "Run at least 2 API instances."
  }
}

variable "api_max_instances" {
  type    = number
  default = 6
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_multi_az" {
  type    = bool
  default = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "alert_emails" {
  description = "On-call addresses subscribed to alarms."
  type        = list(string)
  default     = []
}

variable "monthly_budget_usd" {
  description = "AWS spend alert threshold (maps and SMS spend alerts live with those providers)."
  type        = number
  default     = 600
}

variable "admin_ip_allowlist" {
  description = "CIDRs allowed to reach the admin console and admin API (office / VPN egress)."
  type        = list(string)
}

variable "synthetic_otp_phone" {
  description = "Ops-owned Egyptian mobile (E.164) that receives the hourly synthetic OTP. Empty disables the check."
  type        = string
  default     = ""
}

variable "otp_sends_alert_per_15min" {
  description = "SMS spend guard: alert when more OTPs than this are sent in 15 minutes (pumping or a bot wave)."
  type        = number
  default     = 500
}

variable "maps_monthly_calls_alert" {
  description = "Maps spend guard: alert when billable geocoding calls this month exceed this."
  type        = number
  default     = 20000
}
