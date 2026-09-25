'use client';
import { useFavorites, useMe, useToggleFavorite } from '@agarha/api-client';
import type { ListingCard } from '@agarha/schemas';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { track } from '@/lib/analytics';
import { useRouter } from '@/i18n/routing';

/** Favorites need a phone-OTP account (Q6); signed-out taps go to sign-in and come back. */
export function FavoriteButton({
  card,
  variant = 'overlay',
}: {
  card: ListingCard;
  variant?: 'overlay' | 'inline';
}) {
  const t = useTranslations('web.listing');
  const me = useMe();
  const favs = useFavorites(!!me.data);
  const toggle = useToggleFavorite();
  const router = useRouter();
  const on = !!favs.data?.items.some((c) => c.id === card.id);
  const onClick = () => {
    if (!me.data) {
      router.push(`/account?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    toggle.mutate({ listingId: card.id, on: !on, card });
    track(on ? 'favorite_removed' : 'favorite_added', { listing_id: card.id });
  };
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t('saved') : t('save')}
      onClick={onClick}
      className={
        variant === 'overlay'
          ? 'inline-flex size-11 items-center justify-center rounded-full bg-card/90 shadow-1'
          : 'inline-flex min-h-touch items-center gap-2 rounded-md border border-border px-3'
      }
    >
      <Heart
        aria-hidden
        className={on ? 'size-5 fill-danger text-danger' : 'size-5'}
        strokeWidth={1.75}
      />
      {variant === 'inline' ? <span>{on ? t('saved') : t('save')}</span> : null}
    </button>
  );
}
