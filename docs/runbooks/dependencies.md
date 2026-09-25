# Dependencies and vulnerabilities

- **Dependabot** (`.github/dependabot.yml`) opens weekly grouped PRs for npm, GitHub Actions, Docker
  and Terraform. Patch/minor updates merge after green CI; majors get a branch and a read of the
  changelog.
- **CI gates** (`.github/workflows/security.yml` and `ci.yml`): gitleaks (secrets), Semgrep
  (`.semgrep.yml` plus the default rules), OSV-Scanner on `pnpm-lock.yaml`, Trivy for the filesystem,
  IaC and every image, and a ZAP baseline against staging. High and critical findings fail the build.
- **Supply chain**: `pnpm-workspace.yaml` blocks git/tarball transitive dependencies
  (`blockExoticSubdeps`), waits 7 days before installing a new release (`minimumReleaseAge`) and refuses
  trust downgrades (`trustPolicy: no-downgrade`); Dependabot uses the same 7-day cooldown; GitHub
  Actions are pinned to commit SHAs (Dependabot bumps them with the tag in a comment). A security fix
  needed sooner: add the package to `minimumReleaseAgeExclude` in the same PR.
- **Overrides** in `pnpm-workspace.yaml` pin patched transitive versions (`sharp`, `postcss`, `uuid`).
  Remove an override once the direct dependency ships the fix.

## Known medium or low advisories (accepted, reviewed 2026-09-25)

OSV-Scanner reports no high or critical advisories. The remaining ones:

| Package                          | Advisory                                                                | CVSS | Where                                                   | Why accepted                                                                                                                                      | Exit                                               |
| -------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `decode-uri-component` 0.2.2     | GHSA-vcc3-ghjq-m6fr (DoS on malformed `%` sequences)                    | 6.6  | **Mobile runtime** via `expo-router` → `query-string@7` | The fix (0.5.0) is ESM-only and `query-string@7` `require`s it; the worst case is a hang parsing a crafted deep link on the attacker's own device | Upgrade when expo-router moves to `query-string@9` |
| `vitest`, `@vitest/mocker` 3.2.x | GHSA-82fw-gwwq-j7x9 (file read via the mock redirect in the dev server) | 5.9  | Dev/test only                                           | Tests run in CI and on developer machines, not exposed to the network                                                                             | Upgrade to vitest 4.1.11+ (major; config changes)  |
| `esbuild` 0.18.20                | GHSA-67mh-4wv8-2f99 (dev server CORS)                                   | 5.3  | Dev only (transitive via drizzle-kit)                   | Its dev server is never started                                                                                                                   | Goes away with the next drizzle-kit                |
| `esbuild` 0.27.7                 | GHSA-g7r4-m6w7-qqqr (dev server file read, Windows)                     | 2.5  | Dev only                                                | Linux CI, dev server not used                                                                                                                     | Dependabot                                         |

None of the dev-only packages are in the server images, which `pnpm deploy --prod` builds from
production dependencies only. Re-check at every Dependabot run; escalate if one reaches a runtime image
or becomes high.

## Upgrading frameworks

- **Next.js**: upgrade web and admin together; run the Playwright suites, the visual snapshots
  (`pnpm --filter @agarha/web test:e2e --update-snapshots` only after reviewing the diffs) and
  `pnpm --filter @agarha/web budget`.
- **Expo SDK**: `npx expo install --fix`, then `expo prebuild --clean`, the mobile tests, an EAS
  preview build and the Maestro flows. SDK upgrades need a store build (not an OTA update).
- **NestJS / Drizzle**: API unit and integration suites, then the contract test against
  `docs/api/openapi.json` (`node scripts/openapi-diff.mjs`).
