# ADR-0001: Modular monolith — one API and one worker

- Status: Accepted · Date: 2026-09

## Context

A small team, one product, low early traffic, and a domain (dealers, listings, leads, reviews, billing)
whose parts change together. Microservices would add network hops, deploy pipelines and distributed
transactions without a scaling need.

## Decision

One NestJS codebase (`apps/api`) split into modules under `src/modules/*` (identity, dealers, catalog,
listings, media, search, leads, reviews, moderation, verification, billing, notifications, analytics,
admin, health). Modules talk through their exported services only (`index.ts` barrels); each owns its
tables (`src/db/schema/*`). The same image runs in three roles: `api` (HTTP), `worker` (BullMQ jobs,
cron schedules, image processing) and `migrate` (one-shot). `apps/worker` is a thin wrapper.

## Consequences

- One deploy, one transaction boundary, simple local dev.
- Module boundaries are a convention; ESLint import rules and code review keep them honest.
- A module can be extracted later (search and notifications are the likely candidates) because it
  already sits behind a port/adapter interface.
