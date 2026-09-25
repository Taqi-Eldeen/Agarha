# ADR-0004: Authentication and sessions

- Status: Accepted · Date: 2026-09

## Decision

| Audience  | Sign-in                                                                     | Second factor   |
| --------- | --------------------------------------------------------------------------- | --------------- |
| Customers | Phone OTP (Egyptian mobile). Optional Google / Apple, then link a phone.    | —               |
| Dealers   | Phone + password (≥10 chars, common-password list)                          | TOTP or SMS OTP |
| Admins    | Google Workspace SSO restricted to `GOOGLE_WORKSPACE_DOMAIN` + IP allowlist | TOTP (required) |

- Access tokens: 15-minute HS256 JWTs (jose). Refresh tokens: opaque, stored as SHA-256 hashes,
  rotated on every use; reusing a rotated token revokes the whole family.
- Refresh lifetime: customers and dealers 30 days (family cap 180 / 90 days); admins 1 day.
- Web: `HttpOnly; Secure; SameSite=Lax` cookies on `COOKIE_DOMAIN`. Mobile: tokens in SecureStore.
- OTP codes, IP addresses and log user ids are HMAC-SHA-256 hashed with `HASH_PEPPER` (phone numbers
  are stored in E.164 because dealers must call back); TOTP secrets are AES-256-GCM encrypted
  with `TOTP_ENCRYPTION_KEY`.
- Every OTP request is gated by Cloudflare Turnstile and per-phone / per-IP rate limits.
- Production refuses to boot with the development placeholder secrets or the Turnstile test secret.

## Consequences

- No passwords for customers (lower friction, no credential stuffing), at the cost of SMS spend
  (see ADR-0015).
- Rotating `JWT_SECRET` signs everyone out within 15 minutes; see `docs/runbooks/secrets.md`.
