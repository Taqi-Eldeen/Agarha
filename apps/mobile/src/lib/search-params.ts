import type { SearchParams } from '@agarha/api-client';
import type { PricePeriod } from '@agarha/schemas';

type Sort = NonNullable<SearchParams['sort']>;

/** URL params (deep links, recent searches) → typed search params. */
export function paramsFrom(p: Record<string, string | string[] | undefined>): SearchParams {
  const s = (k: string) => (typeof p[k] === 'string' && p[k] ? (p[k] as string) : undefined);
  const n = (k: string) => (s(k) && Number.isFinite(Number(s(k))) ? Number(s(k)) : undefined);
  const out: SearchParams = {};
  for (const k of ['city', 'area', 'type', 'make', 'q'] as const) if (s(k)) out[k] = s(k);
  if (s('period') === 'week' || s('period') === 'month') out.period = s('period') as PricePeriod;
  if (s('transmission') === 'automatic' || s('transmission') === 'manual')
    out.transmission = s('transmission') as 'automatic' | 'manual';
  if (n('priceMax')) out.priceMax = n('priceMax');
  if (n('seatsMin')) out.seatsMin = n('seatsMin');
  if (s('airport') === 'true') out.airport = true;
  if (['price_asc', 'price_desc', 'newest'].includes(s('sort') ?? '')) out.sort = s('sort') as Sort;
  return out;
}
