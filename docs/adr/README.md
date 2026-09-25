# Architecture Decision Records

One file per decision, [MADR](https://adr.github.io/madr/)-style: context, decision, consequences.
**Status** is `Accepted` (built and in force), `Proposed` (built with a default, needs owner sign-off)
or `Open` (a default is wired in but the choice is the owner's — see the "Needs" line).

| #    | Decision                                                                                             | Status   |
| ---- | ---------------------------------------------------------------------------------------------------- | -------- |
| 0001 | [Modular monolith: one API + one worker](0001-modular-monolith.md)                                   | Accepted |
| 0002 | [PostgreSQL + PostGIS, Drizzle, row-level security](0002-postgres-postgis-drizzle-rls.md)            | Accepted |
| 0003 | [Search in Postgres first, Meilisearch behind a flag](0003-search-in-postgres.md)                    | Accepted |
| 0004 | [Authentication and sessions](0004-authentication.md)                                                | Accepted |
| 0005 | [Prices as a separate table with day/week/month rules](0005-listing-prices.md)                       | Accepted |
| 0006 | [Availability freshness bands and auto-hide](0006-freshness.md)                                      | Proposed |
| 0007 | [Pre-moderate a dealer's first five listings](0007-pre-moderation.md)                                | Proposed |
| 0008 | [Frontend stack and shared packages](0008-frontend-stack.md)                                         | Accepted |
| 0009 | [Arabic-first, RTL, Western digits](0009-locale-and-digits.md)                                       | Proposed |
| 0010 | [Hosting region](0010-hosting-region.md)                                                             | **Open** |
| 0011 | [Maps and geocoding provider](0011-maps-provider.md)                                                 | **Open** |
| 0012 | [Text on accent stays dark in both themes](0012-accent-text.md)                                      | Accepted |
| 0013 | [Media on Cloudflare R2](0013-media-storage-r2.md)                                                   | Accepted |
| 0014 | [MinIO image for local S3](0014-local-minio-image.md)                                                | Accepted |
| 0015 | [OTP delivery: two SMS providers + WhatsApp fallback](0015-otp-delivery.md)                          | Accepted |
| 0016 | [Dealer billing: plans, VAT, featured listings, Paymob](0016-billing.md)                             | **Open** |
| 0017 | [CSP allows inline scripts/styles at v1](0017-csp-unsafe-inline.md)                                  | Proposed |
| 0018 | [Dealer response-rate definition](0018-response-rate.md)                                             | Proposed |
| 0019 | [Review eligibility](0019-review-eligibility.md)                                                     | Proposed |
| 0020 | [Data retention and account deletion](0020-data-retention.md)                                        | **Open** |
| 0021 | [Hosting topology: AWS ECS behind Cloudflare, one account per environment](0021-hosting-topology.md) | Proposed |
| 0022 | [Mobile bot protection and social sign-in](0022-mobile-turnstile-social-sign-in.md)                  | Accepted |
| 0023 | [Forms: React Hook Form + shared Zod schemas](0023-forms.md)                                         | Accepted |
| 0024 | [Deferred at v1: passkeys, customer payments, in-app chat](0024-deferred-v1.md)                      | Proposed |
