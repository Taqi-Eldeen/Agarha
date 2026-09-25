// EXPO_PUBLIC_* values are inlined at build time (eas.json profiles set them per variant).
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  webHost: process.env.EXPO_PUBLIC_WEB_HOST ?? 'agarha.com',
  /** Cloudflare test key (always passes) unless a real one is configured. */
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
};

export const webOrigin = () => `https://${env.webHost}`;
