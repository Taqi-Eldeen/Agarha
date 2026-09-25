# ADR-0006: Availability freshness bands and auto-hide

- Status: Proposed (thresholds need product sign-off) · Date: 2026-09

## Context

The main customer complaint in the category is calling about cars that are already rented. Freshness
of the dealer's "available" switch is the product's core promise.

## Decision

Bands from the last availability confirmation (`packages/schemas/src/freshness.ts`):

| Band    | Age       | Effect                                                           |
| ------- | --------- | ---------------------------------------------------------------- |
| fresh   | < 48 h    | Green badge, full ranking weight                                 |
| aging   | 2–7 days  | Neutral badge, ranking decays linearly                           |
| stale   | 7–14 days | Warning badge, bottom of results, dealer nudged by WhatsApp/push |
| expired | ≥ 14 days | Hidden from search automatically until re-confirmed              |

`freshnessScore` falls linearly from 1 to 0 over 14 days. One tap on the dealer dashboard reconfirms.

## Consequences

- Dealers who ignore nudges lose visibility; the thresholds are constants and easy to tune after
  interviews (see `docs/research/`).
