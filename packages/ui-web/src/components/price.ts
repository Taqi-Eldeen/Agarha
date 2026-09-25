import type { PricePeriod } from '@agarha/schemas';

export interface Prices {
  day: number;
  week: number | null;
  month: number | null;
  deposit: number;
}

/** Effective price for a period: explicit weekly/monthly price, else derived from the daily one. */
export function priceFor(p: Prices, period: PricePeriod): number {
  if (period === 'week') return p.week ?? p.day * 7;
  if (period === 'month') return p.month ?? p.day * 30;
  return p.day;
}
