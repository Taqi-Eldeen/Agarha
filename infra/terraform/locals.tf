locals {
  name = "agarha-${var.environment}"
  prod = var.environment == "production"

  hosts = {
    web   = local.prod ? var.domain : "staging.${var.domain}"
    api   = local.prod ? "api.${var.domain}" : "api.staging.${var.domain}"
    admin = local.prod ? "admin.${var.domain}" : "admin.staging.${var.domain}"
    media = local.prod ? "media.${var.domain}" : "media.staging.${var.domain}"
  }

  # Secrets the API and worker read at boot (values are set out of band in Secrets Manager; see
  # docs/runbooks/secrets.md). Non-secret config is plain environment in the task definitions.
  api_secret_keys = [
    "JWT_SECRET", "HASH_PEPPER", "TOTP_ENCRYPTION_KEY", "TURNSTILE_SECRET_KEY",
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID",
    "VONAGE_API_KEY", "VONAGE_API_SECRET", "VONAGE_SIGNATURE_SECRET",
    "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "EXPO_ACCESS_TOKEN", "RESEND_API_KEY",
    "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY",
    "GOOGLE_MAPS_API_KEY", "MAPBOX_ACCESS_TOKEN",
    "PAYMOB_SECRET_KEY", "PAYMOB_PUBLIC_KEY", "PAYMOB_HMAC_SECRET",
    "MEILI_API_KEY", "POSTHOG_API_KEY", "SENTRY_DSN",
  ]
}
