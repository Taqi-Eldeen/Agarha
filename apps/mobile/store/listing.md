# Store listing — Agarha (أجّرها)

Copy lives in `packages/i18n/src/messages/app.ts` (`app.store`) so it is reviewed with the rest of the
catalogue and never drifts between Arabic and English. This file holds everything else the App Store
Connect and Google Play Console forms need.

| Field | App Store | Google Play |
| --- | --- | --- |
| Name | أجّرها - إيجار عربيات / Agarha - Car Rental Egypt | same |
| Subtitle / short description | `app.store.subtitle` (30 chars) | `app.store.subtitle` (80 chars) |
| Description | `app.store.description` | `app.store.description` |
| Keywords | `app.store.keywords` (100 chars) | n/a |
| Primary category | Travel | Travel & Local |
| Secondary category | Navigation | — |
| Age rating | 4+ (no objectionable content, no user-generated media shown unmoderated) | Everyone |
| Price | Free, no in-app purchases (dealers pay on the web) | Free, no IAP |
| Support URL | https://agarha.com/ar/help | same |
| Marketing URL | https://agarha.com | same |
| Privacy policy | https://agarha.com/ar/legal/privacy | same |
| Primary language | Arabic (Egypt) | ar-EG, with en-US |
| Availability | Egypt at launch | Egypt at launch |

## Screenshots (6.9", 6.5", 5.5" iPhone; Android phone)

Capture from a production build in both languages, light theme, with synthetic seed data only:

1. Explore — city + type search and featured cars
2. Results — period toggle, freshness chips, WhatsApp + Call on each card
3. Listing — price per day/week/month, deposit and "what you need"
4. Safety — "Never pay a deposit before seeing the car"
5. Map — pins with prices
6. Saved — favourites and saved search alerts

## App Review notes

- Browsing, search and contacting a company need **no account**. Sign-in (mobile number + SMS code)
  is only for saving cars, reviews and reports.
- Account deletion: Account → Delete my account (in-app, immediate; Guideline 5.1.1(v)).
- The app does not rent cars or take payments; it lists verified rental companies (Guideline 3.1.3(e)
  does not apply: no digital goods are sold in the app).
- WhatsApp and phone calls open the system apps; the app never reads messages or call logs.

## Privacy — App Store "App Privacy" answers

Data **linked** to the user:
- Contact info → Phone number: App functionality (sign-in). Not used for tracking.
- User content → Other (reviews, reports): App functionality.
- Identifiers → User ID: App functionality.

Data **not linked** to the user:
- Location → Coarse location: App functionality ("near me", map). Only while in use; never stored.
- Usage data → Product interaction: Analytics (PostHog, EU region, no IDFA).
- Diagnostics → Crash data, performance data: App functionality.

Tracking: **No** (no data shared with data brokers or used for targeted ads; no ATT prompt).
The privacy manifest in `app.config.ts` (`ios.privacyManifests`) matches these answers.

## Privacy — Google Play "Data safety" answers

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Phone number | Yes | No | Yes (only to sign in) | Account management |
| Approximate location | Yes | No | Yes | App functionality |
| App interactions | Yes | No | No | Analytics |
| Crash logs / diagnostics | Yes | No | No | App functionality |
| Other user-generated content (reviews, reports) | Yes | No | Yes | App functionality |

- Data is encrypted in transit (TLS 1.2+).
- Users can request deletion: in-app (Account → Delete my account) and at https://agarha.com/ar/account.
- Committed to the Play Families policy: **not** targeted at children.

## Release checklist

- [ ] `eas build --profile production --platform all`
- [ ] `eas submit --profile production` (App Store Connect app ID and team are chosen interactively
      or via `EXPO_APPLE_*` env; Play needs `secrets/google-play-service-account.json`)
- [ ] Upload screenshots per locale; paste copy from `app.store`
- [ ] Host `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on the web
      app (see `apps/web/src/app/.well-known/`), with the production Team ID and signing SHA-256
- [ ] Staged rollout on Play: 10% → 50% → 100% watching crash-free sessions ≥ 99.5%
