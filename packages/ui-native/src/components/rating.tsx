import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export function RatingStars({ value, size = 'md', onChange }: { value: number; size?: 'sm' | 'md'; onChange?: (v: number) => void }) {
  const { f, colors } = useUi();
  const px = size === 'sm' ? 16 : 28;
  const star = (n: number, filled: boolean) => <Star size={px} color={filled ? colors.accentFeatured : colors.borderDefault} fill={filled ? colors.accentFeatured : 'transparent'} strokeWidth={1.75} />;
  if (onChange)
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={f('rating', { rating: value })} className="flex-row gap-1" style={{ direction: 'ltr' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={f('rating', { rating: n })} onPress={() => onChange(n)} className="size-12 items-center justify-center">
            {star(n, n <= value)}
          </Pressable>
        ))}
      </View>
    );
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={f('rating', { rating: value })} className="flex-row gap-0.5" style={{ direction: 'ltr' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n}>{star(n, n <= Math.round(value))}</View>
      ))}
    </View>
  );
}

export function ReviewItem({ rating, body, date, reply }: { rating: number; body: string | null; date: string; reply: string | null }) {
  const { t, ago } = useUi();
  return (
    <View className="gap-2 border-b border-border py-4">
      <View className="flex-row items-center justify-between">
        <RatingStars value={rating} size="sm" />
        <Text variant="caption" tone="secondary">{ago(date)}</Text>
      </View>
      {body ? <Text>{body}</Text> : null}
      {reply ? (
        <View className="rounded-md bg-brand-subtle p-3">
          <Text variant="caption" weight="semibold">{t.dealerReply}</Text>
          <Text variant="caption">{reply}</Text>
        </View>
      ) : null}
    </View>
  );
}
