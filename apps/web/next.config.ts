import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const media = process.env.NEXT_PUBLIC_MEDIA_URL ?? api;
/** Map style + tile hosts come from the configured provider (Google/Mapbox decision still open). */
const mapOrigin = new URL(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
).origin;

/** Strict CSP (section 11). Turnstile, PostHog, Sentry and the map tiles are the only third parties. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://eu-assets.i.posthog.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${media} ${api} https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org`,
  "font-src 'self'",
  `connect-src 'self' ${api} ${mapOrigin} https://*.basemaps.cartocdn.com https://eu.i.posthog.com https://*.ingest.sentry.io https://challenges.cloudflare.com`,
  'frame-src https://challenges.cloudflare.com',
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  productionBrowserSourceMaps: process.env.ANALYZE === '1',
  poweredByHeader: false,
  transpilePackages: ['@agarha/ui-web'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@agarha/ui-web', '@agarha/api-client'],
  },
  images: { formats: ['image/avif', 'image/webp'], remotePatterns: [new URL(`${media}/**`)] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

// Source maps are uploaded to Sentry by the CI release step (sentry-cli), not by a build plugin.
export default withNextIntl(config);
