# Design: screens, flows and states

The design system is code-first: `packages/tokens` is the single source for colour, type, spacing,
radius, elevation, motion and z-index (section 9). `packages/ui-web` and `packages/ui-native` implement
the same components with the same names, props and states. The hi-fi reference is:

- **Web Storybook** (`pnpm --filter @agarha/ui-web storybook`): every story renders side by side in
  all four ar/en × light/dark modes (the toolbar can isolate one).
- **React Native Storybook** (`pnpm --filter @agarha/mobile storybook`, on device).
- **Visual regression snapshots** (`apps/web/e2e/visual.spec.ts-snapshots`): key pages in
  ar/en × light/dark × desktop/mobile.

**Not included:** a Figma file. The spec asks for a Figma library with the same component names; that
needs a designer seat and is listed as an open item. Component names in code are the ones to use there.

## Screen inventory

| Surface                   | Screens                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public web (`/ar`, `/en`) | Home · City / area / car-type landings · Search (list, filters drawer, map split ≥ 1280 px) · Listing detail · Dealers directory · Dealer profile · For dealers · Saved · Account (sign-in, notifications, export, delete) · Help · Legal (terms, privacy, dealer terms) · 404 · error                            |
| Dealer PWA (`/dealer`)    | Sign-up / sign-in (+ TOTP) · Onboarding (business → branches → documents → review status) · Fleet (availability switches, confirm all) · Add/edit wizard · Leads · Availability requests · Stats · Reviews · Team · Billing (+ checkout) · CSV import · Profile                                                   |
| Admin                     | Dashboard · Dealers (verification queue, suspend) · Listings (moderation) · Reports · Reviews · Catalog · Users (lookup, block, export/delete) · Plans · Audit                                                                                                                                                    |
| Customer app              | Onboarding (language → optional location) · Explore · Search results (sort, filter sheet, price-period toggle) · Listing · Dealer · Map (clusters, search this area, mini card) · Saved · Account · Sign-in (OTP, Apple, Google + phone link) · Report · Review · Request availability · Help · Legal · Not found |

Every list and detail screen has loading (skeletons), empty (with a next action) and error (with
retry) states, in both languages and both themes; the component states are in Storybook
(`EmptyState`, `ErrorState`, `ListingCardSkeleton`, …).

## Key flows

**Customer (web and app)**

1. Landing page or Google result → search (city/area, type, price, transmission, seats, driver option).
2. Results → listing: price for the chosen period, deposit, requirements, freshness, dealer card.
3. WhatsApp or Call (no sign-up) → `POST /v1/leads` → reference `AG-XXXX` in the prefilled message.
4. If signed in, a review prompt 24 h later (push or in-app) → lead-gated review → moderation.

**Dealer (PWA)**

1. Phone OTP sign-up + password → business details (CR, tax card) → branch → documents.
2. Ops verification in admin → notified → add cars with the wizard (< 3 minutes: camera upload,
   client-side resize, defaults from the model) → first 5 listings pre-moderated, then live.
3. Weekly "still available?" nudge (WhatsApp/push) → confirm all in one tap → leads and stats.

**Ops**
Verification queue → document viewer (5-minute signed URLs, every view audited) → approve/reject with
reason → listings, reports and reviews queues → per-dealer kill switch (suspend hides all listings).

## RTL and bilingual rules

- Logical properties only (lint rule `agarha/no-physical-direction`); directional icons mirror,
  logos, media controls and phone numbers do not.
- Western digits in both languages (ADR-0009); prices through `formatEgp`.
- All copy in `packages/i18n` (lint rule `agarha/no-jsx-literal`); Arabic written natively.
