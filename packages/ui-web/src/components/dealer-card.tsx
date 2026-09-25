import { BadgeCheck, MessageCircleReply } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUi } from '../lib/ui-context';
import { RatingStars } from './rating';

export interface DealerCardProps {
  name: string;
  href: string;
  verified: boolean;
  area?: string;
  reviews: { count: number; average: number | null };
  responseRate: number | null;
  responseRateLabel: string;
  memberSinceLabel?: string;
  actions?: ReactNode;
}

export function DealerCard({ name, href, verified, area, reviews, responseRate, responseRateLabel, memberSinceLabel, actions }: DealerCardProps) {
  const { t, f } = useUi();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label={name}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <a href={href} className="text-body font-semibold hover:underline">
            {name}
          </a>
          {area ? <p className="text-caption text-fg-secondary">{area}</p> : null}
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-brand">
            <BadgeCheck aria-hidden className="size-5" strokeWidth={1.75} />
            {t.verified}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-caption text-fg-secondary">
        {reviews.average !== null ? (
          <span className="flex items-center gap-1">
            <RatingStars value={reviews.average} size="sm" />
            <span>{f('reviewsCount', { count: reviews.count })}</span>
          </span>
        ) : null}
        {responseRate !== null ? (
          <span className="flex items-center gap-1">
            <MessageCircleReply aria-hidden className="size-4" strokeWidth={1.75} />
            {responseRateLabel}
          </span>
        ) : null}
        {memberSinceLabel ? <span>{memberSinceLabel}</span> : null}
      </div>
      {actions}
    </section>
  );
}
