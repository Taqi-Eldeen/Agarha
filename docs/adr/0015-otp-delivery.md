# ADR-0015: OTP delivery — two SMS providers with failover, WhatsApp fallback

- Status: Accepted · Date: 2026-09

## Decision

- `SMS_PROVIDERS` is an ordered list (production requires two: `twilio,vonage`). A send failure or a
  failed delivery receipt fails over to the next provider. WhatsApp authentication templates are an
  optional third channel (`WHATSAPP_OTP_ENABLED`).
- The OTP is sent synchronously in the request (not via the queue) so the user gets a clear error
  immediately and failover happens inside the same request (p95 budget 3 s).
- The worker publishes OTP delivery-rate metrics (EMF → CloudWatch) with an alarm below 90 %; see
  `docs/runbooks/otp-outage.md`.
- Egyptian sender-ID registration is required by the carriers; alphanumeric sender "Agarha".

## Consequences

- Two contracts to maintain; cost per OTP roughly USD 0.05–0.10 to Egyptian mobiles.
