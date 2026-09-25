import type { Locale } from '@agarha/schemas';
import { webOrigin } from './env';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Maps a website path (universal / app link, push payload) to an app route. Returns null for pages
 * the app doesn't have, so the caller can fall back to the home tab.
 *   /ar/cars/<uuid>-<slug> → /cars/<uuid>     /en/dealers/<slug> → /dealers/<slug>
 *   /ar/search?city=cairo  → /search?city=cairo  /ar/cairo[/maadi] → /search?city=cairo[&area=maadi]
 */
export function webPathToAppPath(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input, webOrigin());
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'ar' || parts[0] === 'en') parts.shift();
  const [first, second, third] = parts;
  if (!first) return '/';
  if (first === 'cars' && second) {
    const id = new RegExp(`^(${UUID})`, 'i').exec(second)?.[1];
    return id ? `/cars/${id.toLowerCase()}` : null;
  }
  if (first === 'dealers' && second) return `/dealers/${encodeURIComponent(second)}`;
  if (first === 'dealers') return '/';
  if (first === 'search') return `/search${url.search}`;
  if (['saved', 'account'].includes(first)) return `/${first}`;
  if (['help', 'legal', 'for-dealers', 'dealer'].includes(first)) return null;
  if (/^[a-z-]+$/.test(first)) return `/search?city=${first}${second && /^[a-z-]+$/.test(second) && !third ? `&area=${second}` : ''}`;
  return null;
}

/** Public web URL for sharing (opens the app when installed, the website otherwise). */
export function listingShareUrl(locale: Locale, id: string, slug: string): string {
  return `${webOrigin()}/${locale}/cars/${id}-${slug}`;
}
