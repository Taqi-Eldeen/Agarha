import type { PricePeriod } from '@agarha/schemas';
import { Phone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '../lib/ui-context';
import { Button } from './button';
import { PriceTag, type Prices } from './price-tag';
import { WhatsAppIcon } from './whatsapp-icon';

export interface ContactBarProps {
  prices: Prices;
  period?: PricePeriod;
  onContact: (channel: 'whatsapp' | 'call') => void;
  contacting?: 'whatsapp' | 'call' | null;
  /** "Never pay a deposit before seeing the car" (risk #2). Shown above the bar on native. */
  notice?: ReactNode;
}

/** Sticky bottom bar: price + WhatsApp (primary) and Call are always visible on the listing screen. */
export function ContactBar({
  prices,
  period = 'day',
  onContact,
  contacting,
  notice,
}: ContactBarProps) {
  const { t, colors } = useUi();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="gap-2 border-t border-border bg-card px-3 pt-3 shadow-md"
      style={{ paddingBottom: Math.max(12, insets.bottom) }}
    >
      {notice}
      <PriceTag prices={prices} period={period} showDeposit />
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          size="lg"
          variant="whatsapp"
          icon={<WhatsAppIcon />}
          loading={contacting === 'whatsapp'}
          onPress={() => onContact('whatsapp')}
        >
          {t.whatsapp}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          icon={<Phone size={20} color={colors.textPrimary} strokeWidth={1.75} />}
          loading={contacting === 'call'}
          onPress={() => onContact('call')}
        >
          {t.call}
        </Button>
      </View>
    </View>
  );
}
