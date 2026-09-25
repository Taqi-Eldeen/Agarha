# Deploy

## Staging (automatic)

1. Merge a PR to `main`. `.github/workflows/deploy.yml` runs the full CI, builds the api, worker,
   migrate, web and admin images tagged with the commit SHA (web/admin get `-staging` because public
   URLs are baked in at build time), and scans them with Trivy; high/critical findings block the deploy.
2. `terraform apply` with `envs/staging.tfvars` rolls the ECS services to the new image tag.
3. `scripts/ci/run-migrations.sh staging` runs the one-off `migrate` task. Migrations are
   **expand-only** in the same release as the code (see `database.md`).
4. `aws ecs wait services-stable`; the ECS deployment circuit breaker rolls back tasks that fail
   health checks.
5. Smoke (`scripts/ci/smoke.sh`) and the Playwright smoke suite against staging.

## Production (tag + approval)

1. Pick a commit on `main` that is green on staging. Tag it: `git tag vX.Y.Z <sha> && git push origin vX.Y.Z`.
2. `.github/workflows/release.yml` checks the commit is on `main`, records the previous release tag
   as the rollback target, and waits for approval on the `production` environment (required
   reviewers).
3. Images are copied **by digest** from the staging registry to the production registry (no rebuild);
   web/admin use their `-production` builds from the same commit.
4. Terraform apply → migrations → wait for stable → smoke. Any failure triggers the automatic
   rollback job (re-applies the previous tag's images; see `rollback.md`).

## Mobile

- `.github/workflows/mobile.yml` runs on the same `vX.Y.Z` tags: EAS production builds, submitted to
  TestFlight and the Play internal track. Manual dispatch: `rollout` (Play staged rollout 10 % → 50 % →
  100 %), `hotfix` (JS-only EAS Update; runtime version = app version), `e2e` (Maestro).
- Native changes need a store build; bump `version` in `apps/mobile/app.config.ts`.

## Preview environments

With the repository variable `PREVIEWS_ENABLED=true`, `.github/workflows/preview.yml` creates
`agarha_pr_<n>` on the staging database server for every PR, deploys `pr-<n>.agarha.com` /
`pr-<n>-api.agarha.com`, comments the URL, and tears both down when the PR closes.

## Checklist before tagging

- [ ] Staging smoke green on the commit
- [ ] Migrations in this release are expand-only
- [ ] CHANGELOG entry
- [ ] Feature flags for risky features default off in PostHog
- [ ] Manual screen-reader pass on the changed flows: VoiceOver (iOS app + Safari), TalkBack (Android
      app), NVDA (Chrome, web and dealer PWA), in Arabic and English — reading order, labels, focus
      after dialogs and sheets, live regions for results and toasts
- [ ] Mobile: cold start on a mid-range Android (target < 2.5 s), results list scroll at 60 fps
      (Perf Monitor), store download size < 40 MB
