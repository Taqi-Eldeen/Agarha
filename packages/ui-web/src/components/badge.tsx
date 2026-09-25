import { freshnessOf } from '@agarha/schemas';
import { BadgeCheck, Clock, Sparkles, UserRound, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

type Kind = 'verified' | 'featured' | 'fresh' | 'stale' | 'driver';

const STYLES: Record<Kind, string> = {
  verified: 'bg-brand-subtle text-brand',
  featured: 'bg-featured text-featured-fg',
  fresh: 'bg-available/10 text-available',
  stale: 'bg-stale/10 text-stale',
  driver: 'bg-info/10 text-info',
};
const ICONS: Record<Kind, ReactNode> = {
  verified: <BadgeCheck aria-hidden className="size-4" strokeWidth={1.75} />,
  featured: <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />,
  fresh: <Zap aria-hidden className="size-4" strokeWidth={1.75} />,
  stale: <Clock aria-hidden className="size-4" strokeWidth={1.75} />,
  driver: <UserRound aria-hidden className="size-4" strokeWidth={1.75} />,
};

/** Status colours always come with an icon and a text label (never colour alone). */
export function Badge({ kind, children, className }: { kind: Kind; children?: ReactNode; className?: string }) {
  const { t } = useUi();
  const text = children ?? { verified: t.verified, featured: t.featured, fresh: t.fresh, stale: t.stale, driver: t.withDriver }[kind];
  return (
    <span className={cn('inline-flex min-h-7 max-w-full items-center gap-1 rounded-2xl px-2 py-0.5 text-label font-medium', STYLES[kind], className)}>
      {ICONS[kind]}
      {text}
    </span>
  );
}

/** Freshness chip: green < 48h, amber 2–7 days, hidden otherwise (the timestamp text still shows elsewhere). */
export function FreshnessChip({ lastConfirmedAt }: { lastConfirmedAt: string }) {
  const { f, ago } = useUi();
  const state = freshnessOf(new Date(lastConfirmedAt));
  if (state === 'fresh') return <Badge kind="fresh">{f('confirmedAgo', { ago: ago(lastConfirmedAt) })}</Badge>;
  if (state === 'aging') return <Badge kind="stale">{f('confirmedAgo', { ago: ago(lastConfirmedAt) })}</Badge>;
  return null;
}
