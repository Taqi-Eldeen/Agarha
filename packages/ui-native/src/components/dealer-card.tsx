import { BadgeCheck, MessageCircleReply } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { RatingStars } from './rating';
import { Text } from './text';

export interface DealerCardProps {
  name: string;
  onPress?: () => void;
  verified: boolean;
  area?: string;
  reviews: { count: number; average: number | null };
  responseRate: number | null;
  responseRateLabel: string;
  memberSinceLabel?: string;
  actions?: ReactNode;
}

export function DealerCard({
  name,
  onPress,
  verified,
  area,
  reviews,
  responseRate,
  responseRateLabel,
  memberSinceLabel,
  actions,
}: DealerCardProps) {
  const { t, f, colors } = useUi();
  return (
    <View accessibilityLabel={name} className="gap-3 rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Pressable
          accessibilityRole={onPress ? 'link' : 'text'}
          onPress={onPress}
          disabled={!onPress}
          className="shrink"
        >
          <Text weight="semibold">{name}</Text>
          {area ? (
            <Text variant="caption" tone="secondary">
              {area}
            </Text>
          ) : null}
        </Pressable>
        {verified ? (
          <View className="flex-row items-center gap-1">
            <BadgeCheck size={20} color={colors.brandPrimary} strokeWidth={1.75} />
            <Text variant="caption" weight="medium" tone="brand">
              {t.verified}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap items-center gap-4">
        {reviews.average !== null ? (
          <View className="flex-row items-center gap-1">
            <RatingStars value={reviews.average} size="sm" />
            <Text variant="caption" tone="secondary">
              {f('reviewsCount', { count: reviews.count })}
            </Text>
          </View>
        ) : null}
        {responseRate !== null ? (
          <View className="flex-row items-center gap-1">
            <MessageCircleReply size={16} color={colors.textSecondary} strokeWidth={1.75} />
            <Text variant="caption" tone="secondary">
              {responseRateLabel}
            </Text>
          </View>
        ) : null}
        {memberSinceLabel ? (
          <Text variant="caption" tone="secondary">
            {memberSinceLabel}
          </Text>
        ) : null}
      </View>
      {actions}
    </View>
  );
}
