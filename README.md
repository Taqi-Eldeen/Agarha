# Agarha (أجّرها)

Car-rental listings for Egypt. Customers find rental cars from verified dealers, see the real price,
deposit and requirements upfront, and contact the dealer directly on WhatsApp or by phone. Agarha is
not a party to the rental: no bookings, payments or deposits between customers and dealers.

| App                     | Path          | What                                                                    |
| ----------------------- | ------------- | ----------------------------------------------------------------------- |
| Public web + dealer PWA | `apps/web`    | Next.js 15 (App Router), `/ar` + `/en`, dealer portal at `/dealer`      |
| Admin console           | `apps/admin`  | Next.js, `admin.` subdomain, Google Workspace SSO + TOTP, never indexed |
| Customer app            | `apps/mobile` | Expo SDK 57 / React Native, iOS + Android                               |
| API                     | `apps/api`    | NestJS modular monolith, REST under `/v1`, OpenAPI in `docs/api`        |
| Worker                  | `apps/worker` | Same codebase as the API, BullMQ jobs and schedules, separate process   |

Shared packages: `tokens` (design tokens → CSS variables, Tailwind and NativeWind presets), `ui-web`
and `ui-native` (same component names and props), `schemas` (Zod, shared by forms and the API),
`api-client` (typed OpenAPI client + TanStack Query hooks), `i18n` (all copy in Arabic and English,
formatters), `config` (ESLint, TypeScript, Prettier), `test-utils` (factories, MSW handlers).

Docs: [`docs/`](docs) — [master checklist](CHECKLIST.md), [ADRs](docs/adr), [runbooks](docs/runbooks),
[data map](docs/data-map.md), [decision log](docs/decision-log.md), [risk register](docs/risk-register.md),
[legal checklist](docs/legal-checklist.md), [research](docs/research), [design](docs/design),
[performance](docs/performance.md), [accounts and keys](docs/accounts-and-keys.md), [changelog](CHANGELOG.md).

## Requirements

- Node.js 22 LTS and pnpm 10 (`corepack enable`)
- Docker (Postgres/PostGIS, Redis and MinIO for local development; Testcontainers for integration tests)
- For mobile: Xcode (iOS) and/or Android Studio, or the Expo Go / a development build on a device

## Run locally

```bash
pnpm install
pnpm db:up                                   # Postgres 16 + PostGIS, Redis 7, MinIO (infra/docker-compose.yml)

cp apps/api/.env.example apps/api/.env       # works as-is: every third-party service uses a mock adapter
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm build                                   # builds the shared packages (and apps)
pnpm --filter @agarha/api db:migrate
pnpm --filter @agarha/api db:seed            # catalog (cities, areas, makes, models, trims), plans, 4 demo dealers with cars

pnpm --filter @agarha/api dev                # API    http://localhost:4000  (Swagger UI at /docs)
pnpm --filter @agarha/api dev:worker         # worker: photo processing, notifications, schedules
pnpm --filter @agarha/web dev                # web    http://localhost:3000/ar  (dealer portal: /ar/dealer)
pnpm --filter @agarha/admin dev              # admin  http://localhost:3001
pnpm --filter @agarha/mobile dev             # Expo; Android emulator uses EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

Local sign-in:

- **Customers and dealers**: any Egyptian mobile number (e.g. `01012345678`). With
  `SMS_PROVIDERS=console` the code is printed in the API log (`SMS to +2010…`). The Turnstile test keys
  in the examples always pass.
- **Dealer portal**: sign up a new dealer at `/ar/dealer/sign-up`, then verify it in the admin
  console (Dealers → review).
- **Admin**: "Development sign-in" as `admin@agarha.com`, TOTP secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`
  (local/CI only; the API refuses the dev sign-in in production).

Useful commands:

```bash
pnpm lint && pnpm typecheck && pnpm test     # all packages and apps (Turborepo)
pnpm test:integration                        # API against Postgres/PostGIS + Redis in Testcontainers
pnpm --filter @agarha/web e2e                # Playwright: customer, dealer, visual (needs the stack running)
pnpm --filter @agarha/admin e2e              # Playwright: admin verification
pnpm --filter @agarha/web budget             # route JS budgets (listing page < 170 KB gzipped)
pnpm --filter @agarha/mobile test            # jest-expo component tests
pnpm --filter @agarha/mobile e2e             # Maestro flows (emulator/simulator + dev build)
pnpm --filter @agarha/ui-web storybook       # web Storybook, every story in ar/en × light/dark
pnpm --filter @agarha/mobile storybook       # React Native Storybook on device
pnpm --filter @agarha/api openapi            # regenerate docs/api/openapi.json (commit it with API changes)
pnpm --filter @agarha/api worker:run <job>   # run one scheduled job now (freshness, retention, sitemap, …)
```

Quality gates beyond unit tests (all in CI; see `.github/workflows`):

| Check                               | Command                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Contract (no breaking `/v1` change) | `node scripts/openapi-diff.mjs docs/api/openapi.json <new>`                             |
| Accessibility                       | axe in every Playwright page test                                                       |
| Lighthouse CI                       | `npx @lhci/cli autorun` (config: `lighthouserc.json`, needs `next start` on :3000)      |
| Load (5× launch peak)               | `docker run --rm -i --network host grafana/k6 run - < load/k6/browse-and-contact.js`    |
| Secrets                             | `gitleaks detect` (config `.gitleaks.toml`)                                             |
| SAST                                | `semgrep --config .semgrep.yml --config p/default`                                      |
| Dependencies                        | `osv-scanner --lockfile pnpm-lock.yaml`, Trivy `fs` / `config` / `image`                |
| DAST                                | ZAP baseline against staging (`.github/workflows/security.yml`, rules `.zap/rules.tsv`) |
| Infrastructure                      | `cd infra/terraform && terraform test` (mock providers, no credentials)                 |

## Configuration

Every app validates its environment at start. The `.env.example` files are complete and documented:
[`apps/api`](apps/api/.env.example) (API + worker), [`apps/web`](apps/web/.env.example),
[`apps/admin`](apps/admin/.env.example), [`apps/mobile`](apps/mobile/.env.example). Outside local
development, values come from AWS Secrets Manager (API/worker), build arguments (web/admin public
values) and EAS profiles/secrets (mobile). Never commit `.env` files; gitleaks runs in CI.

Every third-party service sits behind an interface with a working mock adapter (SMS, WhatsApp, push,
email, storage, maps, payments, Turnstile, search engine, analytics). The keys and accounts needed for
real environments are listed in [`docs/accounts-and-keys.md`](docs/accounts-and-keys.md).

## Deploy

Infrastructure is Terraform only (`infra/terraform`, AWS + Cloudflare). The pipeline:

1. **Pull request** → lint, typecheck, unit + integration + contract tests, build, security scans, and a
   preview environment (`pr-<n>.agarha.com`, own database) when `PREVIEWS_ENABLED=true`.
2. **Merge to `main`** → images tagged by commit SHA → staging (Terraform apply, expand-only migrations,
   ECS rolling deploy with circuit breaker) → smoke + E2E smoke.
3. **Tag `vX.Y.Z`** → manual approval → the same images promoted to production → migrations → smoke →
   automatic rollback to the previous tag on failure. The mobile workflow builds with EAS on the same
   tag (TestFlight, Play internal track, staged rollout 10 % → 50 % → 100 %).

First-time setup of an environment: create the AWS accounts and the Cloudflare zone, then follow
[`infra/README.md`](infra/README.md), fill the `agarha-<env>/keys` secret
([`docs/runbooks/secrets.md`](docs/runbooks/secrets.md)) and set the GitHub environment variables.
Day-to-day procedures: [`docs/runbooks`](docs/runbooks) (deploy, rollback, restore, incident, database,
secrets, OTP outage, dependencies).

## Conventions

TypeScript `strict`; shared ESLint/Prettier; lint rules ban hardcoded JSX strings and physical
left/right CSS (logical properties only, for RTL); import boundaries between apps, packages and API
modules. Conventional Commits. Every significant decision is an ADR; OpenAPI is updated in the same PR
as any API change.
