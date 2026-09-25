# OTP outage

Alarms: `agarha-<env>-otp-failures` (send failures above 10 % over 15 minutes),
`agarha-<env>-otp-synthetic` (the hourly synthetic send + verify to `SYNTHETIC_OTP_PHONE` failed twice;
run it by hand with `pnpm --filter @agarha/api worker:run otp_synthetic`), `agarha-<env>-sms-spend`
(unusual send volume), or support reports "code not arriving".

1. **Scope.** CloudWatch metrics `Agarha/OtpSendAttempts` and `Agarha/OtpFailurePercent` (published
   by the worker every 5 minutes). All providers or one? One carrier (Vodafone, Orange, Etisalat/e&, WE)? Check
   `notification_deliveries` for recent `otp` rows: `status`, `provider`, `error`.
2. **Provider status pages**: Twilio, Vonage, Meta (WhatsApp).
3. **Fail over.** The API already tries providers in `SMS_PROVIDERS` order per request. If the first
   one accepts messages but they are not delivered, swap the order (`SMS_PROVIDERS=vonage,twilio`) in
   the task definition and force a new deployment.
4. **WhatsApp fallback.** Set `WHATSAPP_OTP_ENABLED=true` (template `agarha_otp` must be approved) so
   the sign-in screen offers "send via WhatsApp".
5. **Abuse check.** A sudden rise in requests to unusual prefixes is SMS pumping: tighten the
   Cloudflare rate-limit rule on `/v1/auth/otp/request`, set Turnstile to "managed" challenge, and
   lower the per-IP limit.
6. **Communicate.** Post on the status page and social accounts; dealers and customers who are
   already signed in keep working (30-day sessions).
7. After recovery, restore the provider order and write up the incident.
