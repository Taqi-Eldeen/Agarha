# Decision log

A running log of product and business decisions: what was decided, by whom, and where it lives. The
technical decisions are ADRs in `docs/adr/`. "Claude (default)" means a default chosen during the build
so work could continue; each one is reversible unless marked, and all are listed for owner review.

| #   | Date    | Decision / question                                                                        | Status                                  | Owner             | Reference                      |
| --- | ------- | ------------------------------------------------------------------------------------------ | --------------------------------------- | ----------------- | ------------------------------ |
| Q1  | 2026-09 | Hosting region: Frankfurt (default) vs UAE/Bahrain — PDPL cross-border transfer            | **Open**, hard to reverse after launch  | Founder + counsel | ADR-0010                       |
| Q2  | 2026-09 | Maps and geocoding provider: Google vs Mapbox vs OSM tiles                                 | **Open**                                | Founder           | ADR-0011                       |
| Q3  | 2026-09 | Payment gateway Paymob, dealer-only payments, plan prices and listing caps                 | **Open** (built on a mock)              | Founder           | ADR-0016                       |
| Q4  | 2026-09 | Primary domain: `agarha.com` is taken (parked since 2014); buy it or launch on `agarha.eg` | **Open**                                | Founder           | research/domain-and-handles.md |
| Q5  | 2026-09 | Retention periods (leads 24 months, rejected docs 90 days)                                 | **Open**, legal review                  | Counsel           | ADR-0020                       |
| Q6  | 2026-09 | App Review demo login (test phone number with a fixed OTP, production-safe)                | **Open**                                | Founder           | legal-checklist.md             |
| Q7  | 2026-09 | CSP keeps `'unsafe-inline'` for scripts at v1                                              | Claude (default)                        | Tech lead         | ADR-0017                       |
| Q8  | 2026-09 | Freshness thresholds (48 h / 7 d / 14 d) and pre-moderating the first 5 listings           | Claude (default), confirm in interviews | Product           | ADR-0006, ADR-0007             |
| D1  | 2026-09 | Customers never pay on Agarha at v1; contact is call, WhatsApp or an availability request  | Claude (default)                        | Product           | ADR-0024                       |
| D2  | 2026-09 | Arabic default locale, Western digits                                                      | Claude (default), confirm (C7)          | Product           | ADR-0009                       |
| D3  | 2026-09 | Customer sign-in by phone OTP; Google/Apple need a phone link before contacting            | Claude (default)                        | Product           | ADR-0004, ADR-0022             |
| D4  | 2026-09 | Every review is moderated before publishing; one per dealer per 30 days                    | Claude (default)                        | Product           | ADR-0019                       |
| D5  | 2026-09 | Response rate: 90 days, 24 h window, hidden below 5 samples                                | Claude (default)                        | Product           | ADR-0018                       |
| D6  | 2026-09 | Separate AWS accounts for staging and production; Cloudflare in front                      | Claude (default)                        | Tech lead         | ADR-0021                       |
| D7  | 2026-09 | Two SMS providers with failover (Twilio + Vonage), WhatsApp as third channel               | Claude (default)                        | Tech lead         | ADR-0015                       |
| D8  | 2026-09 | Lighthouse CI uses DevTools throttling; TBT hard limit 350 ms (target 200)                 | Claude (default)                        | Tech lead         | performance.md                 |
