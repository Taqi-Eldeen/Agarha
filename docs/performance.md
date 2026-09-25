# Performance budgets and results

Targets (section 11): LCP < 2.5 s, INP < 200 ms, CLS < 0.1 at p75 on mid-range Android over 4G;
listing-page JS < 170 KB gzipped; API p95 < 300 ms reads / < 600 ms writes; 5× launch peak (~50 req/s).

## How it is measured

| Check            | Tool                                                                                                      | Gate                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Route JS budgets | `pnpm --filter @agarha/web budget` (`apps/web/scripts/check-budget.mjs`, gzipped first-load JS per route) | Listing, home, city ≤ 170 KB; search (includes filters and the map toggle) ≤ 200 KB |
| Lab web vitals   | Lighthouse CI (`lighthouserc.json`): home, search, city landing, for-dealers; 3 runs, median              | LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 350 ms (errors); FCP ≤ 1.8 s, score ≥ 0.9 (warnings)  |
| Field web vitals | Sentry performance + PostHog web-vitals events                                                            | p75 alerting after launch                                                           |
| Load             | k6 `load/k6/browse-and-contact.js` (browse, search, listing, lead) at 50 req/s                            | p95 < 300 ms, errors < 1 %                                                          |
| Mobile           | `expo export` bundle size, cold start on a mid-range Android device (manual per release)                  | JS bundle, app size < 40 MB                                                         |

**Throttling choice.** Lighthouse runs with DevTools (packet-level) throttling: 150 ms RTT,
1.6 Mbps, 4× CPU. With the default _simulated_ throttling against a localhost server, Lighthouse
extrapolates from a trace in which every request completes in under 5 ms; the same build gave LCP
anywhere from 2.9 s to 4.7 s while the observed paint was ~200 ms. DevTools throttling slows the real
requests, so the numbers are stable and reflect the page.

**TBT.** The lab proxy for INP. The budget is 350 ms as a hard gate, with a 200 ms target. The
remaining cost on card-heavy pages is React hydrating the listing cards (client components, ~180 ms
at 4× CPU). Follow-up: render the card body on the server and hydrate only the favourite and contact
buttons.

## Results (2026-09-25, production build, synthetic seed)

| Page                    | LCP       | CLS   | TBT        |
| ----------------------- | --------- | ----- | ---------- |
| `/ar`                   | 1.7 s     | 0.00  | ~200 ms    |
| `/en/search?city=cairo` | 1.6–2.0 s | 0.004 | 155–230 ms |
| `/ar/cairo`             | 1.7 s     | 0.00  | 230–300 ms |
| `/ar/for-dealers`       | 1.6 s     | 0.00  | ~120 ms    |

Route JS (gzipped first load): listing 165.3 KB, home 163.8 KB, search 180.9 KB, city 161.8 KB.
k6 at 50 req/s for 5 minutes: p95 16 ms, 0 errors (single API instance on the build machine).

## What moved the numbers

- Heading font (`Rubik`) uses `display: optional` and is preloaded; body fonts are not preloaded and
  use metric-matched fallbacks, so text paints immediately without a layout shift.
- Search results are server-rendered and seed the client query (`useSearch(…, initial)`).
- The site layout's `<main>` is at least one viewport tall, so content streamed after the shell never
  pushes visible content down (search CLS 0.21 → 0.004).
- Client components get only the message namespaces they use (`apps/web/src/lib/messages.ts`).
- Footer and category/area tile links don't prefetch; the map (MapLibre) loads only when shown.
