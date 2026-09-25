# ADR-0008: Frontend stack and shared packages

- Status: Accepted · Date: 2026-09

## Decision

- **Web + dealer PWA:** Next.js 15.5 (App Router, RSC), next-intl, Tailwind CSS 3.4, Radix primitives
  wrapped in `packages/ui-web`. Server-rendered search and landing pages for SEO and LCP.
- **Admin:** separate Next.js app (`apps/admin`) on its own host with IP allowlist.
- **Mobile:** Expo SDK 57 (React Native 0.86), expo-router, NativeWind 4, `packages/ui-native` with the
  same component names and props as `ui-web`. EAS Build/Submit/Update.
- **Shared:** `packages/tokens` (design tokens → CSS variables and Tailwind presets for both),
  `packages/schemas` (Zod), `packages/i18n` (all copy, both languages), `packages/api-client`
  (openapi-fetch + TanStack Query hooks generated from `docs/api/openapi.json`).
- Tailwind stays on 3.4 because NativeWind 4 requires it; move both to Tailwind 4 together.
- Map: MapLibre GL on web (style URL per provider), react-native-maps on mobile.

## Consequences

- Contract drift is caught in CI (`scripts/openapi-diff.mjs`, contract tests).
