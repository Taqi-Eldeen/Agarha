# Accounts and keys you need to provide

Everything runs locally and in CI on mock adapters. Real environments need the accounts below. Use
sandbox/test keys in staging and live keys only in production. Where a key goes:
**SM** = AWS Secrets Manager `agarha-<env>/keys` (`docs/runbooks/secrets.md`), **GH** = GitHub
environment secret or variable, **EAS** = Expo EAS secret or `eas.json` profile, **TF** = Terraform
variable (`TF_VAR_*` in CI).

## Infrastructure

| Account                                                               | What to create                                                                                                             | Keys / values                                                                                                                      | Where         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| AWS (2 accounts: staging, production, ideally in an AWS Organization) | S3 bucket + DynamoDB table for Terraform state; an OIDC deploy role trusted by this GitHub repo                            | `AWS_DEPLOY_ROLE_ARN` per GitHub environment, `AWS_STAGING_READ_ROLE_ARN` (production pulls images from staging ECR), `AWS_REGION` | GH            |
| Cloudflare                                                            | Account + zone for the chosen domain (ADR-0010 / domain Q4); R2 enabled; API token with Zone:Edit, DNS, WAF, R2, Turnstile | `CLOUDFLARE_API_TOKEN`, `cloudflare_account_id`, `cloudflare_zone_id`                                                              | GH / TF       |
| Cloudflare R2                                                         | Access key for the two buckets (Terraform creates the buckets)                                                             | `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`                                                                               | SM            |
| Cloudflare Turnstile                                                  | One widget per environment (Terraform can create it)                                                                       | `TURNSTILE_SECRET_KEY` (SM), site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`                         | SM / GH / EAS |
| Domain registrar                                                      | `agarha.eg` / `agarha.com.eg` (Egyptian entity needed) or the purchase of `agarha.com`                                     | Name servers → Cloudflare                                                                                                          | —             |

## Messaging

| Account                         | Keys                                                                                                                      | Where                 | Notes                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Twilio (SMS provider 1)         | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, status webhook URL                             | SM                    | Register the alphanumeric sender ID for Egypt; set a spend alert in the console                                               |
| Vonage (SMS provider 2)         | `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_SIGNATURE_SECRET`                                                          | SM                    | Production refuses to start with fewer than two SMS providers                                                                 |
| Meta WhatsApp Business Platform | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (system user), `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | SM                    | Start business verification early; approve templates `agarha_otp`, `agarha_lead_alert`, `agarha_availability_nudge` (ar + en) |
| Expo push                       | `EXPO_ACCESS_TOKEN`                                                                                                       | SM                    | Enhanced push security token                                                                                                  |
| Resend (email)                  | `RESEND_API_KEY`; verify the sending domain (SPF, DKIM, DMARC records)                                                    | SM                    | `EMAIL_FROM` defaults to `no-reply@<domain>`                                                                                  |
| Synthetic OTP number            | A SIM owned by ops that receives the hourly check                                                                         | `synthetic_otp_phone` | TF                                                                                                                            |

## Maps, payments, search

| Account                                         | Keys                                                                                                                                                | Where    | Notes                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| Google Maps Platform (default choice, ADR-0011) | `GOOGLE_MAPS_API_KEY` (Geocoding, server, IP-restricted); `GOOGLE_MAPS_ANDROID_API_KEY` (Maps SDK for Android, restricted to the package + SHA-256) | SM / EAS | Set budget alerts in Google Cloud                           |
| or Mapbox                                       | `MAPBOX_ACCESS_TOKEN`; a style URL for `NEXT_PUBLIC_MAP_STYLE_URL`                                                                                  | SM / GH  | Set `MAPS_PROVIDER=mapbox`                                  |
| Paymob (ADR-0016)                               | `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_IDS` (card, wallet)                                             | SM       | Needs the merchant contract; recurring billing enabled      |
| Meilisearch (optional, P6 flag)                 | `MEILI_HOST`, `MEILI_API_KEY`                                                                                                                       | SM       | Only when the `search_engine_meilisearch` flag is turned on |

## Sign-in

| Account                        | Keys                                                                                                                            | Where    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Google Cloud OAuth (customers) | Client IDs for iOS, Android and web → `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`; all of them in `GOOGLE_CLIENT_IDS`                      | EAS / SM |
| Apple Developer                | Sign in with Apple: App ID capability + Services ID → `APPLE_CLIENT_IDS`; Team ID → `APPLE_TEAM_ID` (web app-site association)  | SM / GH  |
| Google Workspace (admins)      | OAuth client for the admin console → `ADMIN_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_ADMIN_GOOGLE_CLIENT_ID`; `GOOGLE_WORKSPACE_DOMAIN` | SM / GH  |
| —                              | Office IP ranges for `ADMIN_IP_ALLOWLIST` / `admin_ip_allowlist`                                                                | TF       |

## Observability and analytics

| Account            | Keys                                                                                                                                                             | Where         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Sentry             | DSNs for api, web, mobile (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`); `SENTRY_ORG`, `SENTRY_AUTH_TOKEN` for source maps                  | SM / GH / EAS |
| PostHog (EU cloud) | Project API key (`POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`); feature flags created with the names in `apps/api/src/infra/flags.ts` | SM / GH / EAS |
| Alert recipients   | On-call emails/phones for `alert_emails`                                                                                                                         | TF            |

## Mobile stores

| Account                                     | Keys                                                                                                                                               | Where    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Expo / EAS                                  | `EXPO_OWNER`, `EAS_PROJECT_ID`, `EXPO_TOKEN`                                                                                                       | GH / EAS |
| Apple Developer Program + App Store Connect | Team ID, bundle `com.agarha.app`, ASC API key for `eas submit`, App Review demo number (open question Q6)                                          | EAS      |
| Google Play Console                         | App `com.agarha.app`, service-account JSON for `eas submit`, **Play App Signing SHA-256** → `ANDROID_SHA256_CERT_FINGERPRINTS` (Android App Links) | EAS / GH |

## Generated by you (no account)

`JWT_SECRET`, `HASH_PEPPER` (`openssl rand -base64 48`), `TOTP_ENCRYPTION_KEY` (32 random bytes,
base64), `MOCK_PAYMENT_WEBHOOK_SECRET` (local only). The API refuses to start outside local/test with
the development placeholders.

## GitHub repository configuration (used by `.github/workflows`)

Environments `staging`, `production` (required reviewers = release approval) and `production-deploy`.

- **Secrets**: `AWS_DEPLOY_ROLE_ARN`, `AWS_STAGING_READ_ROLE_ARN`, `CLOUDFLARE_API_TOKEN`, `EXPO_TOKEN`,
  `EXPO_APPLE_APP_SPECIFIC_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_MAPS_ANDROID_API_KEY`,
  `SENTRY_AUTH_TOKEN`.
- **Variables**: `AWS_REGION`, `DOMAIN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`,
  `ADMIN_IP_ALLOWLIST`, `ALERT_EMAILS`, `MAP_STYLE_URL`, `PREVIEWS_ENABLED`, `EXPO_OWNER`,
  `EAS_PROJECT_ID`, `SENTRY_ORG`, and per environment (`STAGING_*` / `PRODUCTION_*`): `WEB_URL`,
  `API_URL`, `MEDIA_URL`, `TURNSTILE_SITE_KEY`, `POSTHOG_KEY`, `SENTRY_DSN_WEB`,
  `ADMIN_GOOGLE_CLIENT_ID`, plus `PRODUCTION_PUBLIC_SITE` (`on` at public launch).
