# Database

## Migrations: expand / contract

Migrations are SQL files in `apps/api/drizzle` (generated with `pnpm --filter @agarha/api db:generate`
and reviewed by hand). They run before new code serves traffic, so **the previous release must keep
working on the new schema**:

- **Expand** (same release as the code): add nullable columns or columns with defaults, new tables,
  new indexes `CONCURRENTLY`, backfills in batches from the worker.
- **Contract** (a later release, once no running code uses the old shape): drop columns, add
  `NOT NULL`, remove old tables.
- Never rename a column in one step: add the new one, dual-write, backfill, switch reads, drop later.
- Lock-safety: `SET lock_timeout = '5s'` at the top of any migration that alters a busy table.

## PostGIS and extensions

Migration `0000_extensions.sql` creates `postgis`, `pg_trgm` and `pgcrypto`. On RDS the
migration user needs `rds_superuser` once; locally the compose image has them. `agarha_app` is the
restricted role used by `SET LOCAL ROLE` for row-level security; do not grant it `BYPASSRLS`.

## Common tasks

- Connect: the database is in private subnets with no public endpoint, and there is deliberately no
  bastion or ECS Exec. Schema and data changes go through migrations. For a break-glass session,
  add `enable_execute_command = true` to the `api` service plus the `ssmmessages:*` permissions on its
  task role in a reviewed Terraform PR, use `aws ecs execute-command`, and revert afterwards.
- Slow queries: RDS Performance Insights; `EXPLAIN (ANALYZE, BUFFERS)`. Search queries hit
  `search_documents` (GiST index on the location, B-tree indexes on city and freshness).
- Reindex search: `pnpm --filter @agarha/api worker:run sitemap` (rebuilds the projection and sitemap).
- Run any scheduled job by hand: `pnpm --filter @agarha/api worker:run <freshness|retention|...>`.
- Connections: API pool `DATABASE_POOL_MAX` (10) × tasks must stay below `max_connections`
  (db.t4g.medium ≈ 400).
- Preview databases: `node dist/db/preview-db.js create|drop <pr>` (names `agarha_pr_<n>` only).
