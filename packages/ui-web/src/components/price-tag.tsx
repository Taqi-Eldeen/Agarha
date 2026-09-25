'use client';
import type { PricePeriod } from '@agarha/schemas';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { priceFor, type Prices } from './price';

export { priceFor, type Prices };

export function PriceTag({
  prices,
  period = 'day',
  size = 'md',
  showDeposit = false,
}: {
  prices: Prices;
  period?: PricePeriod;
  size?: 'md' | 'lg';
  showDeposit?: boolean;
}) {
  const { t, egp } = useUi();
  const suffix = period === 'week' ? t.perWeek : period === 'month' ? t.perMonth : t.perDay;
  return (
    <div className="flex flex-col">
      <p
        className={cn('ag-tabular font-semibold text-fg', size === 'lg' ? 'text-h2' : 'text-price')}
      >
        {egp(priceFor(prices, period))}
        <span className="ms-1 text-caption font-normal text-fg-secondary">{suffix}</span>
      </p>
      {showDeposit ? (
        <p className="text-caption text-fg-secondary">
          {prices.deposit > 0 ? `${t.deposit}: ${egp(prices.deposit)}` : t.noDeposit}
        </p>
      ) : null}
    </div>
  );
}
