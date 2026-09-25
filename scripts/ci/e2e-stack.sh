#!/usr/bin/env bash
# Starts the full stack for E2E (CI and locally): migrate + seed, then API, worker, web and admin from
# production builds. Expects Postgres (PostGIS) and Redis at DATABASE_URL / REDIS_URL, e.g. from
# `docker compose -f infra/docker-compose.yml up -d` or GitHub Actions service containers.
set -euo pipefail
cd "$(dirname "$0")/../.."
LOG_DIR="${LOG_DIR:-.e2e-logs}"
mkdir -p "$LOG_DIR"

[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/web/.env.local ] || cp apps/web/.env.example apps/web/.env.local
[ -f apps/admin/.env.local ] || cp apps/admin/.env.example apps/admin/.env.local

export NODE_ENV=production
( cd apps/api && node --env-file=.env dist/db/migrate.js && node --env-file-if-exists=.env -r @swc-node/register scripts/seed.ts ) >"$LOG_DIR/seed.log" 2>&1

# The API and worker run with APP_ENV=local so dev-only endpoints (outbox, reset-limits) exist for tests.
( cd apps/api && NODE_ENV=production nohup node --env-file=.env dist/main.js >"../../$LOG_DIR/api.log" 2>&1 & )
( cd apps/api && NODE_ENV=production nohup node --env-file=.env dist/worker/main.js >"../../$LOG_DIR/worker.log" 2>&1 & )
( cd apps/web && nohup npx next start -p 3000 >"../../$LOG_DIR/web.log" 2>&1 & )
( cd apps/admin && nohup npx next start -p 3001 >"../../$LOG_DIR/admin.log" 2>&1 & )

wait_for() {
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$1" && return 0; sleep 2; done
  echo "timed out waiting for $1" >&2
  tail -n 50 "$LOG_DIR"/*.log >&2
  return 1
}
wait_for http://localhost:4000/v1/health
wait_for http://localhost:3000/api/health
wait_for http://localhost:3001/api/health
echo "stack ready"
