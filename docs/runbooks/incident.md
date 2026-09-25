# Incident response

## Severity

| Sev | Examples                                                         | Response                                     |
| --- | ---------------------------------------------------------------- | -------------------------------------------- |
| 1   | Site/API down, sign-in broken for everyone, data leak            | Page on-call now; status update every 30 min |
| 2   | One feature down (search, uploads, billing), OTP delivery < 90 % | Within 30 min in working hours               |
| 3   | Degraded performance, single dealer affected                     | Next working day                             |

## First 15 minutes

1. **Acknowledge** the alarm (SNS email/SMS → on-call). Open an incident channel; one person leads.
2. **Look**: CloudWatch dashboard `agarha-<env>`; alarms: `5xx-rate`, `p95-latency`, `queue-backlog`,
   `otp-failures`, `otp-synthetic`, `sms-spend`, `maps-spend`, `db-free-storage`, Route 53 health
   checks `web-down` / `api-down`, and AWS Budgets. Sentry for new errors.
   `GET https://api.agarha.com/v1/health` shows DB, Redis and queue status.
3. **Recent change?** A deploy in the last hour → `rollback.md` first, investigate after.
4. **Mitigate** before diagnosing: roll back, turn off a flag, scale up
   (`aws ecs update-service --desired-count`), or enable Cloudflare "Under Attack" mode for a flood.

## Common causes

| Symptom                      | Check                                             | Action                                                                     |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| 5xx spike right after deploy | ECS events, Sentry                                | Roll back                                                                  |
| DB CPU 100 %                 | RDS Performance Insights top SQL                  | Kill the query (`pg_cancel_backend`), add the index in an expand migration |
| Queue backlog                | Worker service tasks, logs `/agarha/<env>/worker` | Restart/scale worker; check Redis memory                                   |
| OTP failures                 | `otp-outage.md`                                   | Fail over the SMS provider                                                 |
| Bot traffic / SMS pumping    | Cloudflare analytics, OTP requests by prefix      | Tighten the Cloudflare rate-limit rule, Turnstile to "managed"             |

## Personal-data breach

If personal data may have been exposed: preserve logs, rotate the affected keys (`secrets.md`), and
inform the founder and counsel immediately. PDPL requires notifying the Personal Data Protection Center
within 72 hours and the affected people without undue delay.

## After

Blameless write-up within 5 working days: timeline, impact, root cause, what went well, action items
with owners. Add a regression test or alarm for the cause.
