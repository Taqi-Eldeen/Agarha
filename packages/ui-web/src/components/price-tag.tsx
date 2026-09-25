import type { PricePeriod } from '@agarha/schemas';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

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

export function PriceTag({ prices, period = 'day', size = 'md', showDeposit = false }: { prices: Prices; period?: PricePeriod; size?: 'md' | 'lg'; showDeposit?: boolean }) {
  const { t, egp } = useUi();
  const suffix = period === 'week' ? t.perWeek : period === 'month' ? t.perMonth : t.perDay;
  return (
    <div className="flex flex-col">
      <p className={cn('ag-tabular font-semibold text-fg', size === 'lg' ? 'text-h2' : 'text-price')}>
        {egp(priceFor(prices, period))}
        <span className="ms-1 text-caption font-normal text-fg-secondary">{suffix}</span>
      </p>
      {showDeposit ? <p className="text-caption text-fg-secondary">{prices.deposit > 0 ? `${t.deposit}: ${egp(prices.deposit)}` : t.noDeposit}</p> : null}
    </div>
  );
}
