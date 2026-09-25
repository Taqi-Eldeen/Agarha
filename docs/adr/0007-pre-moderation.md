# ADR-0007: Pre-moderate a dealer's first five listings

- Status: Proposed · Date: 2026-09

## Decision

A verified dealer's first 5 listings (`PRE_MODERATION_COUNT = 5`, `listings.service.ts`) go to the
moderation queue before publishing. After that, listings publish immediately and are covered by
post-moderation: user reports, automated checks (duplicate photos, price outliers) and admin sampling.

## Consequences

- Catches scam or low-quality dealers early without a permanent moderation bottleneck.
- Moderation SLA during launch should be under 4 business hours; staffing is an open item.
