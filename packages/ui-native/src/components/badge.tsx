import { freshnessOf } from '@agarha/schemas/freshness';
import { BadgeCheck, Clock, Sparkles, UserRound, Zap } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

type Kind = 'verified' | 'featured' | 'fresh' | 'stale' | 'driver';

// Same as ui-web: label in text/primary on a tint (4.5:1); the status colour lives in the tint + icon.
const BOX: Record<Kind, string> = {
  verified: 'bg-brand-subtle',
  featured: 'bg-featured',
  fresh: 'bg-available/15',
  stale: 'bg-stale/15',
  driver: 'bg-info/15',
};

/** Status colours always come with an icon and a text label (never colour alone). */
export function Badge({ kind, children, className }: { kind: Kind; children?: ReactNode; className?: string }) {
  const { t, colors } = useUi();
  const text = children ?? { verified: t.verified, featured: t.featured, fresh: t.fresh, stale: t.stale, driver: t.withDriver }[kind];
  const Icon = { verified: BadgeCheck, featured: Sparkles, fresh: Zap, stale: Clock, driver: UserRound }[kind];
  const iconColor = { verified: colors.brandPrimary, featured: colors.accentOnFeatured, fresh: colors.statusAvailable, stale: colors.statusStale, driver: colors.statusInfo }[kind];
  return (
    <View className={cn('min-h-7 flex-row items-center gap-1 self-start rounded-2xl px-2 py-0.5', BOX[kind], className)}>
      <Icon size={16} color={iconColor} strokeWidth={1.75} />
      <Text variant="caption" weight="medium" className={kind === 'featured' ? 'text-featured-fg' : 'text-fg'}>
        {text}
      </Text>
    </View>
  );
}

/** Green < 48h, amber 2–7 days, nothing after that (the timestamp still shows on the listing). */
export function FreshnessChip({ lastConfirmedAt }: { lastConfirmedAt: string }) {
  const { f, ago } = useUi();
  const state = freshnessOf(new Date(lastConfirmedAt));
  if (state === 'fresh') return <Badge kind="fresh">{f('confirmedAgo', { ago: ago(lastConfirmedAt) })}</Badge>;
  if (state === 'aging') return <Badge kind="stale">{f('confirmedAgo', { ago: ago(lastConfirmedAt) })}</Badge>;
  return null;
}
