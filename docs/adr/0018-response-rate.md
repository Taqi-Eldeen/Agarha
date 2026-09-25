# ADR-0018: Dealer response-rate definition

- Status: Proposed · Date: 2026-09

## Decision

Response rate = (leads the dealer marked with any outcome + availability requests answered within
24 h) ÷ (all leads + all availability requests), over the last 90 days, rounded to 2 decimals.
Hidden (null) below 5 samples so new dealers are not penalised by small numbers.
Implementation: `leads.service.ts#responseRate`.

## Consequences

- Call and WhatsApp leads cannot be observed directly, so "marked an outcome" is a proxy that also
  gives us outcome data for ranking later.
