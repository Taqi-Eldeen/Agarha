import type { PricePeriod } from '@agarha/schemas';
import { priceFor, type Prices } from '@agarha/schemas/price';
import { View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

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
    <View>
      <Text variant={size === 'lg' ? 'h2' : 'price'} style={{ fontVariant: ['tabular-nums'] }}>
        {egp(priceFor(prices, period))}
        <Text variant="caption" tone="secondary">{` ${suffix}`}</Text>
      </Text>
      {showDeposit ? (
        <Text variant="caption" tone="secondary">
          {prices.deposit > 0 ? `${t.deposit}: ${egp(prices.deposit)}` : t.noDeposit}
        </Text>
      ) : null}
    </View>
  );
}
