# Secrets

## Where they live

- **Terraform-owned** (`agarha-<env>/infra` in Secrets Manager): `DATABASE_URL`, `REDIS_URL`.
- **Third-party and app keys** (`agarha-<env>/keys`): created empty by Terraform, filled by a person,
  never overwritten by Terraform. The full key list is `local.api_secret_keys` in
  `infra/terraform/locals.tf`; the meaning of each is in `apps/api/.env.example`.
- **CI**: GitHub environment secrets/variables only (OIDC to AWS, no long-lived AWS keys):
  `CLOUDFLARE_API_TOKEN`, `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`; variables `AWS_DEPLOY_ROLE_ARN`,
  `AWS_REGION`, `*_WEB_URL`, `*_API_URL`.
- **Mobile build-time**: EAS secrets (`GOOGLE_MAPS_ANDROID_API_KEY`, `SENTRY_AUTH_TOKEN`).
- Never in git: `.env*` files are ignored except `.env.example`; gitleaks runs in CI and pre-release.

## Set a key

```sh
aws secretsmanager get-secret-value --secret-id agarha-production/keys --query SecretString --output text > /tmp/k.json
# edit /tmp/k.json, then:
aws secretsmanager put-secret-value --secret-id agarha-production/keys --secret-string file:///tmp/k.json
shred -u /tmp/k.json
aws ecs update-service --cluster agarha-production --service api --force-new-deployment
aws ecs update-service --cluster agarha-production --service worker --force-new-deployment
```

Tasks read secrets at start, so a forced new deployment picks up the change.

## Generate

- `JWT_SECRET`, `HASH_PEPPER`: `openssl rand -base64 48`
- `TOTP_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

The API refuses to start outside local/test with the development placeholders or the Turnstile test
secret.

## Rotation

| Key                                                        | Rotate                                    | Effect                                                                             |
| ---------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `JWT_SECRET`                                               | Yearly or on suspicion                    | Access tokens invalid within 15 min; refresh tokens keep working (opaque, hashed)  |
| `HASH_PEPPER`                                              | Only on compromise                        | Breaks rate-limit and view de-dup keys for a day; OTP challenges in flight fail    |
| `TOTP_ENCRYPTION_KEY`                                      | Only on compromise                        | Needs a re-encryption script: decrypt with old, encrypt with new, in one migration |
| Provider keys (Twilio, Vonage, Meta, Resend, Paymob, maps) | Yearly, on staff change, on suspicion     | Create the new key at the provider, set it, deploy, then revoke the old one        |
| DB password                                                | Terraform `random_password` taint + apply | Rolling restart                                                                    |
