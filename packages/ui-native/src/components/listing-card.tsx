import type { ListingCard as Card, PricePeriod } from '@agarha/schemas';
import { Image } from 'expo-image';
import { BadgeCheck, MapPin, Phone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Badge, FreshnessChip } from './badge';
import { Button } from './button';
import { PriceTag } from './price-tag';
import { Text } from './text';
import { WhatsAppIcon } from './whatsapp-icon';

export interface ListingCardProps {
  card: Card;
  period?: PricePeriod;
  variant?: 'list' | 'grid' | 'map-mini';
  onPress: () => void;
  onContact?: (channel: 'whatsapp' | 'call') => void;
  contacting?: 'whatsapp' | 'call' | null;
  favorite?: ReactNode;
}

/**
 * Same anatomy as the web card (section 9): photo (+Featured) → model/year/transmission → price →
 * freshness → deposit + requirements → dealer, area, verified → WhatsApp (primary) + Call.
 */
export function ListingCard({ card, period = 'day', variant = 'list', onPress, onContact, contacting, favorite }: ListingCardProps) {
  const { locale, t, egp, f, colors } = useUi();
  const name = `${card.make[locale]} ${card.model[locale]}`;
  const photo = card.photo?.url640 ? <Image source={{ uri: card.photo.url640 }} placeholder={card.photo.blurhash ? { blurhash: card.photo.blurhash } : undefined} contentFit="cover" transition={150} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors alt={`${name} ${card.year}`} /> : null;

  if (variant === 'map-mini')
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={`${name} ${card.year}`} onPress={onPress} className="flex-row gap-3 rounded-lg border border-border bg-card p-2">
        <View className="size-24 overflow-hidden rounded-md bg-brand-subtle">{photo}</View>
        <View className="flex-1 justify-center">
          <Text weight="medium" numberOfLines={1}>{`${name} ${card.year}`}</Text>
          <PriceTag prices={card.prices} period={period} />
          <Text variant="caption" tone="secondary" numberOfLines={1}>{card.area[locale]}</Text>
        </View>
      </Pressable>
    );

  if (variant === 'grid')
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={`${name} ${card.year}`} onPress={onPress} className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <View className="aspect-[4/3] w-full bg-brand-subtle">
          {photo}
          {card.featured ? <View className="absolute top-2" style={{ start: 8 }}><Badge kind="featured" /></View> : null}
        </View>
        <View className="gap-1 p-3">
          <Text weight="semibold" numberOfLines={1}>{`${name} ${card.year}`}</Text>
          <PriceTag prices={card.prices} period={period} />
          <FreshnessChip lastConfirmedAt={card.lastConfirmedAt} />
          <Text variant="caption" tone="secondary" numberOfLines={1}>{card.area[locale]}</Text>
        </View>
      </Pressable>
    );

  const reqs = `${card.prices.deposit > 0 ? `${t.deposit} ${egp(card.prices.deposit)}` : t.noDeposit} · ${f('minAge', { age: card.minAge })} · ${card.requiredDocs.map((d) => t.docs[d]).join('، ')}`;
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card">
      <Pressable accessibilityRole="link" accessibilityLabel={`${name} ${card.year}`} onPress={onPress}>
        <View className="aspect-[4/3] w-full bg-brand-subtle">
          {photo}
          {card.featured ? <View className="absolute top-2" style={{ start: 8 }}><Badge kind="featured" /></View> : null}
        </View>
        <View className="gap-2 p-4">
          <Text weight="semibold">
            {`${name} ${card.year} · `}
            <Text tone="secondary">{card.transmission === 'automatic' ? t.automatic : t.manual}</Text>
          </Text>
          <PriceTag prices={card.prices} period={period} />
          <View className="flex-row flex-wrap gap-2">
            <FreshnessChip lastConfirmedAt={card.lastConfirmedAt} />
            {card.driverOption !== 'self' ? <Badge kind="driver">{card.driverOption === 'driver' ? t.withDriver : t.selfOrDriver}</Badge> : null}
            {!card.available ? <Badge kind="stale">{t.unavailable}</Badge> : null}
          </View>
          <Text variant="caption" tone="secondary" numberOfLines={2}>{reqs}</Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={16} color={colors.textSecondary} strokeWidth={1.75} />
            <Text variant="caption" tone="secondary" numberOfLines={1} className="shrink">{`${locale === 'ar' ? card.dealer.nameAr : card.dealer.nameEn} · ${card.area[locale]}`}</Text>
            {card.dealer.verified ? <BadgeCheck size={16} color={colors.brandPrimary} strokeWidth={1.75} accessibilityLabel={t.verified} /> : null}
          </View>
        </View>
      </Pressable>
      {favorite ? <View className="absolute top-2" style={{ end: 8 }}>{favorite}</View> : null}
      {onContact ? (
        <View className="flex-row gap-2 p-4 pt-0">
          <Button className="flex-[3]" variant="whatsapp" icon={<WhatsAppIcon />} loading={contacting === 'whatsapp'} onPress={() => onContact('whatsapp')}>
            {t.whatsapp}
          </Button>
          <Button className="flex-[2]" variant="secondary" icon={<Phone size={20} color={colors.textPrimary} strokeWidth={1.75} />} loading={contacting === 'call'} onPress={() => onContact('call')}>
            {t.call}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export function ListingCardSkeleton() {
  const { t } = useUi();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t.loading} className="overflow-hidden rounded-lg border border-border bg-card opacity-70">
      <View className="aspect-[4/3] bg-brand-subtle" />
      <View className="gap-3 p-4">
        <View className="h-5 w-2/3 rounded bg-border" />
        <View className="h-6 w-1/3 rounded bg-border" />
        <View className="h-4 w-full rounded bg-border" />
        <View className="flex-row gap-2">
          <View className="h-12 flex-[3] rounded-md bg-border" />
          <View className="h-12 flex-[2] rounded-md bg-border" />
        </View>
      </View>
    </View>
  );
}
