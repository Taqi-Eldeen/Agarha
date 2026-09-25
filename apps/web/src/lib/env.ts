// Public env. Plain checks instead of Zod: this module ships to the browser and Zod would add ~26 KB.
function required(name: string, value: string | undefined, fallback: string): string {
  const v = value || fallback;
  if (!/^https?:\/\//.test(v) && name !== 'NEXT_PUBLIC_TURNSTILE_SITE_KEY') throw new Error(`${name} must be an absolute URL`);
  return v;
}

export const env = {
  NEXT_PUBLIC_API_URL: required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000'),
  NEXT_PUBLIC_SITE_URL: required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: required('NEXT_PUBLIC_TURNSTILE_SITE_KEY', process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, '1x00000000000000000000AA'),
  NEXT_PUBLIC_MAP_STYLE_URL: required('NEXT_PUBLIC_MAP_STYLE_URL', process.env.NEXT_PUBLIC_MAP_STYLE_URL, 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'),
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || undefined,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST || undefined,
  NEXT_PUBLIC_PUBLIC_SITE: process.env.NEXT_PUBLIC_PUBLIC_SITE === 'off' ? 'off' : 'on',
} as const;

/** Server-to-server base URL (internal network in production). */
export const apiInternal = process.env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL;
