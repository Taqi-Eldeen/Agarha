# Cloudflare: DNS, CDN, WAF, rate limits, Turnstile and R2 storage (ADR-0013: R2 has no egress fees).

# --- DNS (proxied through Cloudflare) --------------------------------------------------------------
resource "cloudflare_dns_record" "app" {
  for_each = { web = local.hosts.web, api = local.hosts.api, admin = local.hosts.admin }
  zone_id  = var.cloudflare_zone_id
  name     = each.value
  type     = "CNAME"
  content  = aws_lb.main.dns_name
  proxied  = true
  ttl      = 1
}

resource "cloudflare_dns_record" "www" {
  count   = local.prod ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.domain}"
  type    = "CNAME"
  content = var.domain
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "acm_validation" {
  # Keys are static (known at plan time); values come from the certificate after it is requested.
  for_each = local.cert_names
  zone_id  = var.cloudflare_zone_id
  name     = trimsuffix(one([for o in aws_acm_certificate.main.domain_validation_options : o.resource_record_name if o.domain_name == each.value]), ".")
  type     = one([for o in aws_acm_certificate.main.domain_validation_options : o.resource_record_type if o.domain_name == each.value])
  content  = trimsuffix(one([for o in aws_acm_certificate.main.domain_validation_options : o.resource_record_value if o.domain_name == each.value]), ".")
  proxied  = false
  ttl      = 300
}

# --- TLS: 1.2+, HTTPS only, HSTS ------------------------------------------------------------------
resource "cloudflare_zone_setting" "min_tls" {
  count      = local.zone_owner ? 1 : 0
  zone_id    = var.cloudflare_zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "cloudflare_zone_setting" "always_https" {
  count      = local.zone_owner ? 1 : 0
  zone_id    = var.cloudflare_zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "ssl_strict" {
  count      = local.zone_owner ? 1 : 0
  zone_id    = var.cloudflare_zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "hsts" {
  count      = local.zone_owner ? 1 : 0
  zone_id    = var.cloudflare_zone_id
  setting_id = "security_header"
  value = {
    strict_transport_security = { enabled = true, max_age = 31536000, include_subdomains = true, preload = true, nosniff = true }
  }
}

# --- Storage: R2 buckets, public media on a custom domain (cached at the edge) ---------------------
resource "cloudflare_r2_bucket" "public_media" {
  account_id = var.cloudflare_account_id
  name       = "${local.name}-public-media"
  location   = "weur"
}

resource "cloudflare_r2_bucket" "private_docs" {
  account_id = var.cloudflare_account_id
  name       = "${local.name}-private-docs"
  location   = "weur"
}

resource "cloudflare_r2_custom_domain" "media" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.public_media.name
  domain      = local.hosts.media
  zone_id     = var.cloudflare_zone_id
  enabled     = true
}

# --- WAF: admin console only from the allowlist; scraping and abuse limits ------------------------
resource "cloudflare_ruleset" "firewall" {
  count   = local.zone_owner ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "agarha firewall"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [
    {
      description = "Admin console and admin API: allowlisted IPs only"
      expression  = "(http.host in {${join(" ", [for h in local.admin_hosts : "\"${h}\""])}} or (http.host in {${join(" ", [for h in local.api_hosts : "\"${h}\""])}} and starts_with(http.request.uri.path, \"/v1/admin\"))) and not ip.src in {${join(" ", var.admin_ip_allowlist)}}"
      action      = "block"
    },
    {
      description = "No bulk scraping of the search API by non-browser clients"
      expression  = "http.host in {${join(" ", [for h in local.api_hosts : "\"${h}\""])}} and starts_with(http.request.uri.path, \"/v1/search\") and cf.bot_management.verified_bot eq false and cf.client.bot"
      action      = "managed_challenge"
    },
  ]
}

resource "cloudflare_ruleset" "rate_limits" {
  count   = local.zone_owner ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "agarha rate limits"
  kind    = "zone"
  phase   = "http_ratelimit"
  rules = [
    {
      description = "OTP requests (the API also limits 3 per number per 15 min)"
      expression  = "http.host in {${join(" ", [for h in local.api_hosts : "\"${h}\""])}} and starts_with(http.request.uri.path, \"/v1/auth/otp\")"
      action      = "block"
      ratelimit   = { characteristics = ["ip.src", "cf.colo.id"], period = 60, requests_per_period = 10, mitigation_timeout = 600 }
    },
    {
      description = "Lead creation"
      expression  = "http.host in {${join(" ", [for h in local.api_hosts : "\"${h}\""])}} and http.request.uri.path eq \"/v1/leads\""
      action      = "block"
      ratelimit   = { characteristics = ["ip.src", "cf.colo.id"], period = 60, requests_per_period = 30, mitigation_timeout = 300 }
    },
    {
      description = "Search and listings (scraping)"
      expression  = "http.host in {${join(" ", [for h in local.api_hosts : "\"${h}\""])}} and (starts_with(http.request.uri.path, \"/v1/search\") or starts_with(http.request.uri.path, \"/v1/listings\"))"
      action      = "managed_challenge"
      ratelimit   = { characteristics = ["ip.src", "cf.colo.id"], period = 60, requests_per_period = 120, mitigation_timeout = 600 }
    },
  ]
}

# --- Turnstile (bot check before any OTP send) ------------------------------------------------------
resource "cloudflare_turnstile_widget" "otp" {
  account_id = var.cloudflare_account_id
  name       = "${local.name} OTP"
  # The apex covers its subdomains (staging and pr-<n> previews); each environment has its own keys.
  domains = [var.domain]
  mode    = "managed"
}
