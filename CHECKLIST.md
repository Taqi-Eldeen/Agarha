# Master checklist

Every requirement of the build brief, by section. ✅ done and verified · ⚠️ partial (reason) ·
❌ not done (reason). "Owner" marks items that need an account, a contract, a person or a business
milestone that code cannot provide; each still has a working mock or a documented procedure.

Verification pass: 2026-09-25 (see "Final verification" at the end).

## 1–3. Product boundaries, defaults and risks

- ✅ Listings only: no booking, payments or deposits between customer and dealer; no P2P; rentals only (ADR-0024; terms state Agarha is not a party)
- ✅ Required facts on every listing: day/week/month price, deposit, km limit, documents, min age, driver option (`packages/schemas`, wizard validation)
- ✅ WhatsApp and Call always visible; browse and contact without an account (Q6)
- ✅ Freshness visible on every card and listing: green < 48 h, amber 2–7 days, auto-hidden at 14 days (ADR-0006)
- ✅ Verified badge, lead-gated reviews, response rate (ADR-0018, ADR-0019)
- ✅ Arabic-first RTL default, complete English (A1); Western digits via central formatters (A5, ADR-0009)
- ✅ Q1 free at launch, subscriptions + featured in P5 · Q2 Greater Cairo live, other cities seeded inactive · Q3 CR + tax card required · Q4 driver option attribute · Q5 contact only, availability requests in P6 · Q7 lead-gated moderated reviews after 24 h · Q8 dealer PWA, no native dealer app
- ✅ A3 EGP only, deposit separate · A4 add a car in < 3 minutes (wizard defaults, camera upload); ops can create listings for a dealer
- ✅ Risk 1 stale availability: timestamp, one-tap switch, confirm all, weekly nudge, 14-day auto-hide, freshness in ranking
- ✅ Risk 2 fraud: documents before going live, "never pay a deposit before seeing the car" notice, report button, per-dealer kill switch
- ✅ Risk 3 empty marketplace: dealer tooling first, public site behind `NEXT_PUBLIC_PUBLIC_SITE`
- ✅ Risk 4 attribution: `AG-XXXX` reference in the WhatsApp message; "came from Agarha" outcome
- ✅ Risk 5 review manipulation: lead gating, rate limits, moderation queue
- ✅ Risk 6 OTP abuse: Turnstile first, 3 per number per 15 min + per-IP limits, two SMS providers with failover, WhatsApp fallback
- ✅ Risk 7 maps cost: map loads on demand, geocode cache, spend metric + alarm
- ✅ Risk 8 PDPL: minimisation, export and delete, data map, retention, terms
- ✅ Risk 9 scraping: Cloudflare rate limits and bot management, no bulk public API

## 4–5. Stack and repository

- ✅ pnpm + Turborepo, TypeScript strict; structure `apps/{web,admin,mobile,api,worker}`, `packages/{tokens,ui-web,ui-native,schemas,api-client,i18n,config,test-utils}`, `infra`, `docs/{adr,api,runbooks}`, `.github/workflows`
- ✅ Web: Next.js App Router, Tailwind with the shared preset, Radix, next-intl, TanStack Query, React Hook Form + Zod
- ✅ Admin: separate Next.js app on `admin.`, SSO, `noindex`
- ✅ Mobile: Expo Router, NativeWind, persisted TanStack Query, FlashList, expo-image, react-native-maps with clustering, SecureStore, expo-notifications, EAS
- ✅ API: NestJS modular monolith, REST `/v1`, OpenAPI from code; BullMQ worker in the same codebase
- ✅ PostgreSQL + PostGIS, Drizzle SQL migrations, `pg_trgm`, Arabic normalisation (alef forms, yaa/alef maqsura, taa marbuta)
- ✅ Search behind a module interface; Meilisearch adapter behind a flag
- ✅ S3-compatible storage with `public-media` and `private-docs`; Cloudflare edge; Sentry, OpenTelemetry, JSON logs; PostHog analytics + flags
- ✅ Import rules enforced by lint (apps → packages only; API modules only through each other's index)
- ⚠️ Hosting region and maps provider — Owner: built behind interfaces with defaults (Frankfurt, Google), decisions open (ADR-0010, ADR-0011)

## 6. Backend

- ✅ Modules: identity, dealers, verification, catalog, listings, search, leads, reviews, moderation, media, notifications, billing, analytics, admin
- ✅ Data model per the brief (dealer/branch/member/verification doc, city/area/branch/listing/model, photos, prices, leads, favourites, saved searches, reports, reviews, subscriptions, audit log); listing fields and statuses as specified; phones in E.164, input accepts `01X…`, `+20…`, `0020…`
- ✅ API conventions: cursor pagination, `{ code, message, details, requestId }`, idempotency keys on listings/leads/uploads, public reads `s-maxage=60`, private `no-store`, signature-verified webhooks (payments, WhatsApp, SMS receipts)
- ✅ Lead tracking: `POST /v1/leads`, rate limit, `AG-XXXX`, wa.me/tel deep links in the user's language, `lead.created` notifies the dealer, review prompt 24 h later
- ✅ Scheduled jobs: hourly freshness + auto-hide, weekly nudges, saved-search matching, sitemap; plus retention, renewals, featured expiry, synthetic OTP
- ✅ Auth: customer phone OTP + Google/Apple (4.8), dealer OTP + password with TOTP required for owners, admin Google Workspace SSO + TOTP + IP allowlist; 15-minute access tokens, rotating hashed refresh tokens with family revocation; httpOnly Secure SameSite=Lax cookies / SecureStore; RBAC roles; policy layer + RLS; maintained libraries (jose, argon2, otplib; AES-GCM from node:crypto) (ADR-0004)
- ✅ Media pipeline: client resize ≤ 2048 px, presigned PUT with type/size locked, magic bytes, EXIF/GPS strip, WebP/AVIF 320/640/1280, blurhash; 12 photos × 10 MB; documents PDF/JPG ≤ 10 MB in `private-docs`, 5-minute signed URLs, every access audited, no national ID numbers stored as text
- ✅ Notifications: templates per channel and locale, preferences, quiet hours 22:00–09:00 Cairo; Expo push, email (Resend), SMS (two providers, OTP only), WhatsApp; queued, retried with backoff, delivery status logged
- ⚠️ Payments — Owner: Paymob adapter + mock gateway with signed webhooks, subscriptions, featured, invoices; needs the merchant contract and a pricing decision (ADR-0016)

## 7. Information architecture

- ✅ Public web routes: `/`, `/{city}`, `/{city}/{area}`, `/{city}/{car-type}`, `/search` (noindex), `/cars/{id}-{slug}`, `/dealers`, `/dealers/{slug}`, `/for-dealers`, `/saved`, `/account`, `/help`, `/legal/{terms|privacy|dealer-terms}` in `/ar` and `/en`
- ✅ Customer app: onboarding (language, optional location), Explore, Results (sort, filter sheet, period toggle), Listing, Dealer; Map (clusters, search this area, mini card); Saved (favourites, saved searches with alerts); Account (OTP, language, notifications, help, legal, delete); report, review, share
- ✅ Dealer portal: onboarding, fleet with switches + confirm all, wizard, edit/photos/prices/pause/archive, leads with outcomes, stats (views, contacts, conversion, freshness), reviews + reply, team, billing, profile; bottom tabs on phones, sidebar on desktop; installable PWA
- ✅ Admin: dealers (verification, suspend), listings, reports, reviews, catalog (makes, models, trims, types, cities, areas), users (lookup, block, export/delete), plans, audit

## 8. Features by platform

- ✅ Shared MVP: search filters, period toggle and sort, listing detail, dealer profile with branch map, contact with lead tracking, ar/en RTL/LTR, report, OTP account, favourites
- ✅ Shared later: saved searches with alerts, lead-gated reviews, request availability
- ✅ Web-only: SEO landings with Product/Offer and LocalBusiness JSON-LD, sitemaps, hreflang, list + map at ≥ 1280 px, dealer marketing page, admin console
- ✅ Mobile-only: push, "near me" (permission on tap), full-screen map, universal/app links, native share
- ✅ Dealer: onboarding + upload, wizard with camera and resize, optimistic switch with undo, lead log, stats; WhatsApp nudges, team roles, subscriptions and featured; CSV import

## 9. UI/UX

- ✅ Tokens exactly as specified (colours light/dark, typography, spacing, radius, elevation, motion, z-index, Lucide 1.75) in `packages/tokens`; text on accent stays dark (ADR-0012)
- ✅ Components on web and native with shared names/props/states (Button variants, IconButton, TextField/PhoneField/OTPField, Select/Combobox, FilterChip/ChipGroup, Badge, PriceTag, ListingCard list/grid/map-mini/skeleton, DealerCard, RequirementList, Gallery, ContactBar, BottomSheet/Drawer, AvailabilitySwitch, Stepper, PhotoUploader, Toast, InlineAlert, EmptyState, ErrorState, RatingStars, ReviewItem, DataTable, StatTile, MapView/Pin/Cluster)
- ✅ Storybook (web) and Storybook for React Native; every story in ar/en × light/dark
- ⚠️ Figma library and wireframes — Owner: needs a designer seat; code-first design system, screen inventory and flows in `docs/design/README.md`, visual snapshots as hi-fi reference
- ✅ Listing card anatomy (photo + featured, model/year/transmission, price for period, freshness chip, deposit + requirements, dealer/area/verified, WhatsApp + Call)
- ✅ Layout: web top bar; filter rail + list at ≥ 1024 px, list + map at ≥ 1280 px; sticky side contact card; mobile bottom tabs, filter bottom sheet with removable chips, sticky contact bar; breakpoints sm/md/lg/xl as specified
- ✅ Logical properties only, enforced by lint
- ✅ Accessibility: WCAG 2.2 AA contrast, focus states, never colour alone, 44/48 targets, bilingual labels, 200 % text, reduced motion, no autoplay, labels above fields, plain-language errors, next action in every empty/error state; axe on every E2E page
- ⚠️ Manual screen-reader pass (VoiceOver, TalkBack, NVDA) — Owner: a person per release; checklist in `docs/runbooks/deploy.md`

## 10. Engineering standards

- ✅ No `any` (lint error), shared ESLint/Prettier, import boundaries, no hardcoded JSX strings, shared Zod on client and server, ADRs, OpenAPI updated with API changes
- ✅ Unit tests (domain logic: pricing, freshness, permissions, formatters); ≥ 80 % line coverage on domain modules
- ✅ Integration: Jest + Testcontainers (PostGIS, Redis)
- ✅ Contract: OpenAPI diff, no breaking `/v1` change; MSW contract tests for the client
- ✅ Component: Storybook + Testing Library (web: Vitest; native: jest-expo + RNTL)
- ✅ Visual regression: Playwright screenshots, key pages ar/en × light/dark × desktop/mobile
- ✅ E2E web (Playwright): search → listing → contact, dealer onboarding, add car, admin verification
- ⚠️ E2E mobile (Maestro): flows for search-contact, sign-in, favourites, deep link, language switch, account deletion are written and wired into CI (`mobile.yml` `e2e`); not executed here — the build machine has no Android emulator (no KVM) or iOS simulator
- ✅ Performance: Lighthouse CI budgets and k6 at 5× peak
- ✅ Security: Semgrep, OSV + Dependabot, gitleaks, Trivy, ZAP baseline
- ✅ CI/CD: PR (cached install, lint, typecheck, tests, build, scans, preview with branch database + URL), main → staging with migrations and E2E smoke, `vX.Y.Z` → approval → same images → smoke → automatic rollback, mobile EAS on tag → TestFlight / Play internal → 10/50/100 % → EAS Update hotfixes
- ✅ Environments: local compose (Postgres, Redis, MinIO, seeded fake dealers), preview per PR, staging with synthetic data only, production; Zod-validated env; secrets manager; per-environment sandbox keys; flags for unfinished features
- ✅ Deployment: containers, ≥ 2 API instances, rolling deploys with health checks, expand → deploy → contract, Terraform only
- ✅ Monitoring: JSON logs with `requestId`, hashed user id and module, PII/token redaction; OpenTelemetry; Sentry release health; uptime checks on web, API and a synthetic OTP flow; alarms 5xx > 1 %, p95 > 800 ms, backlog > 5 min, OTP failures > 10 %, SMS and maps spend; business dashboard (live listings, freshness %, leads per day, response rate)
- ⚠️ Staging and production actually deployed — Owner: needs the AWS accounts, Cloudflare zone and keys (`docs/accounts-and-keys.md`); every image builds and runs locally, `terraform test` passes

## 11. Quality and security targets

- ✅ Web: listing JS 165 KB < 170 KB; lab LCP 1.7–2.0 s, CLS ≤ 0.06 (`docs/performance.md`)
- ⚠️ TBT (lab proxy for INP) medians 132–345 ms: passes the 350 ms gate, but the 200 ms target is not met on card-heavy pages (city landing 345 ms); fix planned: server-rendered card bodies
- ⚠️ Mobile cold start, 60 fps, download size — measured on a device per release; JS bundle 8.5 MB (Hermes), store size needs a signed build — Owner
- ✅ API p95: 16 ms at 50 req/s (k6)
- ✅ Reliability design: Multi-AZ, PITR (RPO 5 min < 1 h), RTO 4 h runbook, quarterly restore drill procedure
- ✅ Security: ASVS L2-oriented controls, TLS 1.2+, HSTS, CSP (inline allowed, ADR-0017), encryption at rest, least-privilege IAM, MFA on admin accounts, fix SLAs in `docs/runbooks/dependencies.md`
- ⚠️ External pen test before public launch — Owner: vendor engagement; ZAP baseline and API scan pass
- ✅ Privacy: data map, retention (leads 24 months, rejected docs 90 days), export and deletion (immediate, within the 30-day target)
- ✅ Scale: stateless services, autoscaling, 5× peak without code changes
- ✅ Maintainability: coverage, E2E of critical paths, runbooks (deploy, rollback, restore, incident + database, secrets, OTP, dependencies), README setup for a first PR

## 12. Phases

**P0 — Discovery**

- ✅ Dealer and customer interview guides (`docs/research`)
- ✅ Legal checklist (`docs/legal-checklist.md`)
- ✅ Domain and handle checks for Agarha, Aggarha, Ajarha (`docs/research/domain-and-handles.md`) — note `agarha.com` is taken
- ✅ Resolved Q1–Q8 decisions (`docs/decision-log.md`), risk register
- ⚠️ Milestone (sign-off, 10+ pilot dealers) — Owner

**P1 — Design and foundation**

- ✅ Token package; 15+ components with stories and tests
- ⚠️ Wireframes and hi-fi in Figma — Owner (see section 9)
- ✅ Monorepo, CI/CD, environments, Terraform, observability baseline
- ✅ API skeleton with identity (OTP), dealers, seeded catalog
- ⚠️ Milestone "OTP sign-in on staging" — Owner (accounts); works locally, in CI and in E2E

**P2 — Dealer side**

- ✅ Onboarding and document upload · admin verification queue · wizard and media pipeline · availability switch and freshness job · listing moderation, audit log, basic stats · public site hideable
- ⚠️ Milestone (25+ dealers, 300+ listings) — Owner

**P3 — Public web MVP**

- ✅ Home, search, filters, results, listing, dealer, city/area pages · lead tracking, reports, OTP accounts, favourites · structured data, sitemaps, hreflang · performance and a11y budgets, load test
- ⚠️ Pen test — Owner (vendor)

**P4 — Customer app**

- ✅ All tabs and screens · push, saved-search alerts, deep links, share · store listings ar/en, privacy labels, account deletion (`apps/mobile/store/listing.md`)
- ⚠️ TestFlight / Play beta and staged rollout — Owner (Apple/Google/EAS accounts); pipeline ready

**P5 — Trust and monetization**

- ✅ Lead-gated reviews, dealer replies, response rate · WhatsApp nudges and lead alerts · team roles · subscriptions, featured listings, invoices (mock gateway)
- ⚠️ Billing live — Owner (Paymob contract)

**P6 — Scale**

- ✅ Alexandria, North Coast, Red Sea seeded, activated per city from the admin catalog
- ✅ Search engine behind a flag · request-availability flow · CSV import
- ❌ Native dealer app — intentionally not built: the brief makes it conditional on PWA usage data

## 13. Deliverables

- ✅ Docs: ADRs (`docs/adr`), OpenAPI (`docs/api/openapi.json`), runbooks, CHANGELOG
- ✅ Code behind flags where unfinished, tests at every layer, CI gates green
- ⚠️ Builds per phase (staging live, production PWA, store builds, billing enabled) — Owner (accounts)

## 14. Final verification

See the verification log at the end of this file.
