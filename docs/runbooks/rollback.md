# Rollback

## Automatic

If a production release fails migrations, health checks or smoke tests, the `rollback` job in
`release.yml` re-applies Terraform with the previous tag's image (still in ECR), waits for stable
services and re-runs smoke. Check the workflow summary for "Rolled back to <sha>".

## Manual (a release is live but bad)

1. Find the previous good tag: `git tag --sort=-creatordate | head`.
2. Actions → **Release production** → re-run the workflow for that tag, or from a shell with the
   production deploy role:
   ```sh
   cd infra/terraform
   terraform init -backend-config=envs/production.backend.hcl
   terraform apply -var-file=envs/production.tfvars -var image_tag=<previous-sha>
   aws ecs wait services-stable --cluster agarha-production --services api worker web admin
   scripts/ci/smoke.sh https://agarha.com https://api.agarha.com
   ```
3. Database: do **not** roll back migrations. Because every release is expand-only, the previous code
   runs on the new schema. If a migration itself corrupted data, follow `restore.md`.
4. Mobile: `eas update:republish --group <previous-update-group>` on the production channel.
5. Kill switch without a deploy: turn the feature flag off in PostHog (or set `FLAGS` in the task
   definition). Flags (`apps/api/src/infra/flags.ts`): `public_site`, `search_engine_meilisearch`,
   `availability_requests`, `csv_import`, `billing`, `reviews`. A flag lookup failure defaults to off.
6. Write up the incident (`incident.md`).
