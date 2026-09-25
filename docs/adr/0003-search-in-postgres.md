# ADR-0003: Search in Postgres first; Meilisearch behind a flag

- Status: Accepted · Date: 2026-09

## Context

At launch there are hundreds to low thousands of listings. Arabic typo-tolerant text search matters
less than filters, distance and freshness ranking.

## Decision

A denormalised `search_listings` projection in Postgres (updated by the listings module and the
worker) serves search, map and landing pages. Ranking = featured → freshness score → distance → price.
A `SearchEngine` port has a Postgres adapter (default) and a Meilisearch adapter
(`meili.engine.ts`) enabled by the `search_engine_meilisearch` feature flag and `MEILI_HOST`.

## Consequences

- No extra service to run at v1. Switch to Meilisearch when free-text volume or latency justifies it;
  the projection is the source for its index.
