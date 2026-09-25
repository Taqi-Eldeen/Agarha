import type { ListingCard as Card, PricePeriod } from '@agarha/schemas';
import { ListingCard } from '@agarha/ui-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useContact } from '@/lib/contact';

/** A listing card wired to navigation and the contact flow (lead + WhatsApp / dialer). */
export function SearchResultCard({
  card,
  period,
  source,
  favorite,
  variant,
}: {
  card: Card;
  period?: PricePeriod;
  source: string;
  favorite?: ReactNode;
  variant?: 'list' | 'map-mini';
}) {
  const router = useRouter();
  const { contact, busy } = useContact(card.id, source);
  return (
    <ListingCard
      card={card}
      {...(period ? { period } : {})}
      {...(variant ? { variant } : {})}
      favorite={favorite}
      onPress={() => router.push(`/cars/${card.id}`)}
      {...(variant === 'map-mini'
        ? {}
        : { onContact: (c: 'whatsapp' | 'call') => void contact(c), contacting: busy })}
    />
  );
}
