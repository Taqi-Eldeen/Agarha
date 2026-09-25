import type { SearchParams } from '@agarha/api-client';

const NUM = ['priceMin', 'priceMax', 'seatsMin', 'lat', 'lng', 'radiusKm'] as const;

/** URL query → typed search params (shared by the server page and the client view). */
export function paramsFrom(sp: URLSearchParams): SearchParams {
  const p: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) {
    if (!v) continue;
    p[k] = (NUM as readonly string[]).includes(k) ? Number(v) : k === 'airport' ? v === 'true' : v;
  }
  return p as SearchParams;
}
