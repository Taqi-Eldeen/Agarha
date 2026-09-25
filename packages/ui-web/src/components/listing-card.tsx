'use client';
import type { ListingCard as Card, PricePeriod } from '@agarha/schemas';
import { BadgeCheck, MapPin, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Badge, FreshnessChip } from './badge';
import { Button } from './button';
import { BlurImage } from './blur-image';
import { PriceTag } from './price-tag';
import { WhatsAppIcon } from './whatsapp-icon';

export interface ListingCardProps {
  card: Card;
  period?: PricePeriod;
  variant?: 'list' | 'grid' | 'map-mini';
  href: string;
  /** Renders the link (next/link on web). */
  linkAs?: (props: { href: string; className: string; children: ReactNode }) => ReactNode;
  onContact?: (channel: 'whatsapp' | 'call') => void;
  contacting?: 'whatsapp' | 'call' | null;
  favorite?: ReactNode;
  priority?: boolean;
}

/**
 * Anatomy (section 9): photo (+Featured) → model/year/transmission → price for period → freshness →
 * deposit + requirements → dealer, area, verified → WhatsApp (primary) + Call.
 */
export function ListingCard({
  card,
  period = 'day',
  variant = 'list',
  href,
  linkAs,
  onContact,
  contacting,
  favorite,
  priority,
}: ListingCardProps) {
  const { locale, t, egp, f } = useUi();
  const name = `${card.make[locale]} ${card.model[locale]}`;
  const Link =
    linkAs ??
    (({ href: h, className, children }) => (
      <a href={h} className={className}>
        {children}
      </a>
    ));
  const photo = (
    <div
      className={cn(
        'relative overflow-hidden bg-brand-subtle',
        variant === 'map-mini' ? 'size-24 shrink-0 rounded-md' : 'aspect-[4/3] w-full',
      )}
    >
      {card.photo?.url640 ? (
        <BlurImage
          src={card.photo.url640}
          srcSet={`${card.photo.url320} 320w, ${card.photo.url640} 640w`}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          blurhash={card.photo.blurhash}
          alt={`${name} ${card.year}`}
          priority={priority}
        />
      ) : null}
      {card.featured && variant !== 'map-mini' ? (
        <Badge kind="featured" className="absolute start-2 top-2" />
      ) : null}
      {favorite ? <div className="absolute end-2 top-2">{favorite}</div> : null}
    </div>
  );
  const reqs = `${card.prices.deposit > 0 ? `${t.deposit} ${egp(card.prices.deposit)}` : t.noDeposit} · ${f('minAge', { age: card.minAge })} · ${card.requiredDocs.map((d) => t.docs[d]).join('، ')}`;

  if (variant === 'map-mini')
    return (
      <Link href={href} className="flex gap-3 rounded-lg border border-border bg-card p-2">
        {photo}
        <div className="flex min-w-0 flex-col justify-center">
          <p className="truncate font-medium">{`${name} ${card.year}`}</p>
          <PriceTag prices={card.prices} period={period} />
          <p className="truncate text-caption text-fg-secondary">{card.area[locale]}</p>
        </div>
      </Link>
    );

  return (
    <article
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow duration-base hover:shadow-1"
      aria-label={`${name} ${card.year}`}
    >
      <Link href={href} className="flex flex-col focus-visible:outline-offset-[-3px]">
        {photo}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="text-body font-semibold">
            {name} <span className="ag-tabular">{card.year}</span> ·{' '}
            <span className="font-normal text-fg-secondary">
              {card.transmission === 'automatic' ? t.automatic : t.manual}
            </span>
          </h3>
          <PriceTag prices={card.prices} period={period} />
          <div className="flex flex-wrap gap-2">
            <FreshnessChip lastConfirmedAt={card.lastConfirmedAt} />
            {card.driverOption !== 'self' ? (
              <Badge kind="driver">
                {card.driverOption === 'driver' ? t.withDriver : t.selfOrDriver}
              </Badge>
            ) : null}
            {!card.available ? <Badge kind="stale">{t.unavailable}</Badge> : null}
          </div>
          <p className="line-clamp-2 text-caption text-fg-secondary">{reqs}</p>
          <p className="flex items-center gap-1 text-caption text-fg-secondary">
            <MapPin aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{`${locale === 'ar' ? card.dealer.nameAr : card.dealer.nameEn} · ${card.area[locale]}`}</span>
            {card.dealer.verified ? (
              <span className="inline-flex items-center gap-0.5 text-brand">
                <BadgeCheck aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="sr-only md:not-sr-only">{t.verified}</span>
              </span>
            ) : null}
          </p>
        </div>
      </Link>
      {onContact ? (
        <div className="mt-auto grid grid-cols-[3fr_2fr] gap-2 p-4 pt-0 [&>button]:min-w-0 [&>button]:px-2">
          <Button
            variant="whatsapp"
            icon={<WhatsAppIcon />}
            loading={contacting === 'whatsapp'}
            onClick={() => onContact('whatsapp')}
          >
            {t.whatsapp}
          </Button>
          <Button
            variant="secondary"
            icon={<Phone aria-hidden className="size-5" strokeWidth={1.75} />}
            loading={contacting === 'call'}
            onClick={() => onContact('call')}
          >
            {t.call}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function ListingCardSkeleton() {
  const { t } = useUi();
  return (
    <div
      role="status"
      aria-label={t.loading}
      className="flex animate-pulse flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="aspect-[4/3] bg-brand-subtle" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-5 w-2/3 rounded bg-border" />
        <div className="h-6 w-1/3 rounded bg-border" />
        <div className="h-4 w-full rounded bg-border" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="h-12 rounded-md bg-border" />
          <div className="h-12 w-24 rounded-md bg-border" />
        </div>
      </div>
    </div>
  );
}
