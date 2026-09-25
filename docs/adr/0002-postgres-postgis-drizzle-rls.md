# ADR-0002: PostgreSQL 16 + PostGIS, Drizzle ORM, row-level security

- Status: Accepted · Date: 2026-09

## Context

Search is geographic (near me, per area, map viewport) and relational (make/model/price filters).
Dealer staff must never see another dealer's data, even through a buggy query.

## Decision

- PostgreSQL 16 with PostGIS 3.5 (`geography(Point)` on branches; GiST indexes).
- Drizzle ORM for typed queries; SQL migrations in `apps/api/drizzle` run by `migrate` before each
  deploy. Expand/contract only (see `docs/runbooks/database.md`).
- Row-level security on dealer-owned tables. Dealer-portal transactions run
  `SET LOCAL ROLE agarha_app` with `app.dealer_id` set, so a missing `WHERE dealer_id` returns nothing
  instead of leaking. Public reads use projections that expose only published data.

## Consequences

- PostGIS needs the extension created once by a superuser (RDS: `rds_superuser`), handled in
  migration `0000`.
- RLS adds a per-transaction `SET LOCAL`; measured overhead is negligible at our volumes.
