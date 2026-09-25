import { useFavorites, useToggleFavorite } from '@agarha/api-client';
import type { ListingCard } from '@agarha/schemas';
import { IconButton, useUi } from '@agarha/ui-native';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useTranslations } from 'use-intl';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/session';

/** Heart toggle. Signed-out taps open sign-in (saving needs an account; browsing never does). */
export function FavoriteButton({ listingId, card }: { listingId: string; card?: ListingCard }) {
  const { signedIn } = useSession();
  const favorites = useFavorites(!!signedIn);
  const toggle = useToggleFavorite();
  const router = useRouter();
  const t = useTranslations('web.listing');
  const { colors } = useUi();
  const on = !!favorites.data?.items.some((c) => c.id === listingId);
  return (
    <IconButton
      label={on ? t('saved') : t('save')}
      variant="secondary"
      className="rounded-full"
      accessibilityState={{ selected: on }}
      icon={<Heart size={22} color={on ? colors.statusDanger : colors.textPrimary} fill={on ? colors.statusDanger : 'transparent'} strokeWidth={1.75} />}
      onPress={() => {
        if (!signedIn) return router.push('/sign-in');
        track(on ? 'favorite_removed' : 'favorite_added', { listing_id: listingId });
        toggle.mutate({ listingId, on: !on, ...(card ? { card } : {}) });
      }}
    />
  );
}
