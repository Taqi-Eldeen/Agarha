# ADR-0009: Arabic-first, RTL, Western digits

- Status: Proposed · Date: 2026-09

## Decision

- Arabic is the default locale (`/ar`), English the second (`/en`); `x-default` points to Arabic.
  Layouts use logical CSS properties (`ms-*`, `ps-*`) so RTL and LTR share one code path.
- Numbers, prices and phone numbers use Western digits (0–9) in both languages. Egyptian phone
  numbers, plates and prices on dealers' own materials are overwhelmingly written that way, and one
  digit set avoids copy/paste and search mismatches. Arabic-Indic input is normalised on the way in.
- Fonts: IBM Plex Sans Arabic + Rubik, self-hosted, `display: optional` for LCP stability.

## Consequences

- Switch to Arabic-Indic digits later by changing the `numberingSystem` in `packages/i18n` formatters.
- To confirm in customer interviews (question C7 in `docs/research/customer-interview-guide.md`).
