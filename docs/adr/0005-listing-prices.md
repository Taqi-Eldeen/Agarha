# ADR-0005: Prices in `listing_prices` with day/week/month rules

- Status: Accepted · Date: 2026-09

## Decision

Prices live in a `listing_prices` table (one row per listing and period: `day`, `week`, `month`) in
whole EGP, VAT-inclusive as dealers quote them. Day is required; week and month are optional. Shared
validation (`packages/schemas/src/price.ts`) rejects a week price above 7 × day or a month price above
31 × day. `priceFor(days)` picks the cheapest applicable combination for a trip length and is used by
web, mobile and the API.

## Consequences

- Seasonal or per-branch pricing can be added as extra rows later without migrating listings.
- Prices are indicative: the booking and payment happen between customer and dealer (ADR-0024).
