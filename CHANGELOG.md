# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [SemVer](https://semver.org/). The API is versioned separately by URL (`/v1`).

## [1.0.0] — 2026-09-25

First complete version of the platform: phases P0–P6 of the build plan (`CHECKLIST.md`).

### P0 — Discovery

- Dealer and customer interview guides, legal checklist (PDPL, consumer protection, telecom,
  payments, app stores), domain and handle checks for Agarha / Aggarha / Ajarha, decision log (Q1–Q8),
  risk register, and 24 ADRs.

### P1 — Design and foundation

- pnpm + Turborepo monorepo, strict TypeScript, shared ESLint (RTL logical-properties and
  no-hardcoded-strings rules, import boundaries) and Prettier.
- Design tokens (Style Dictionary → CSS variables, Tailwind and NativeWind presets, RN theme); web and
  native component libraries with the same names, props and states; Storybook for both, every story
  in ar/en × light/dark.
- NestJS modular-monolith API with Zod-validated config, OpenAPI, cursor pagination, error envelope
  with `requestId`, idempotency keys, edge caching headers; identity with phone OTP (Turnstile, rate
  limits, two SMS providers with failover, WhatsApp fallback); catalog seeded with cities, areas,
  makes, models and trims.
- docker-compose for local; Terraform for AWS (VPC, ECS Fargate, RDS PostGIS, ElastiCache, ECR,
  Secrets Manager, CloudWatch, Route 53 health checks, Budgets, KMS) and Cloudflare (DNS, TLS, WAF,
  rate limits, R2, Turnstile); `terraform test` with mock providers.

### P2 — Dealer side

- Dealer PWA: onboarding (business → branches → documents), add/edit wizard with camera upload and
  client-side resize, availability switch with optimistic update and undo, confirm all, leads log
  with outcomes, stats, profile. Public site can stay hidden (`NEXT_PUBLIC_PUBLIC_SITE`).
- Media pipeline: presigned uploads, magic-byte validation, EXIF/GPS stripping, WebP/AVIF at
  320/640/1280 and blurhash. Verification documents in a private bucket with 5-minute audited links.
- Admin: verification queue, listing moderation (first 5 listings pre-moderated), audit log.
- Hourly freshness job with auto-hide at 14 days; weekly "still available?" nudges.

### P3 — Public web

- Home, search (filters, list, list + map at ≥ 1280 px), listing, dealer directory and profiles,
  city / area / car-type landings, for-dealers, saved, account, help, legal.
- Lead tracking with `AG-XXXX` references and prefilled WhatsApp messages; reports; phone-OTP
  accounts; favourites.
- SEO: Product/Offer and AutoRental JSON-LD, sitemaps, hreflang, canonical URLs.
- Budgets: route JS, Lighthouse CI, axe on every E2E page, k6 load test, ZAP baseline.

### P4 — Customer app

- Expo app with Explore, Map (clustered pins, search this area), Saved and Account tabs, listing and
  dealer screens, report, review, share; push notifications and saved-search alerts; universal/app
  links; Sign in with Apple and Google with phone linking; account deletion; persisted query cache.
- Store listing copy (ar/en), privacy manifest, EAS profiles, Maestro flows.

### P5 — Trust and monetization

- Lead-gated, moderated reviews with dealer replies; dealer response rate (ADR-0018).
- WhatsApp lead alerts and nudges; dealer team roles (owner, staff).
- Plans, subscriptions, featured listings and invoices behind a `PaymentGateway` port (mock gateway
  with signed webhooks; Paymob adapter).

### P6 — Scale

- Alexandria, North Coast and Red Sea in the catalog (activated per city).
- Meilisearch engine behind the `search_engine_meilisearch` flag.
- Request-availability flow and CSV import.

### Operations and quality

- GitHub Actions: PR checks with preview environments, staging on merge, tagged production releases
  with approval, promotion by digest and automatic rollback; mobile EAS builds and staged rollout;
  weekly security scans.
- Monitoring: structured logs with hashed user ids, Sentry, OpenTelemetry, EMF metrics and alarms
  (5xx, p95, queue backlog, OTP failures, synthetic OTP, SMS and maps spend, uptime), admin business
  dashboard.
- Privacy: data map, export and deletion, retention job (leads 24 months, rejected documents 90 days,
  OTP challenges, sessions, reports and audit entries), marketing notifications opt-in only.
- Runbooks: deploy, rollback, restore, incident, database, secrets, OTP outage, dependencies.
