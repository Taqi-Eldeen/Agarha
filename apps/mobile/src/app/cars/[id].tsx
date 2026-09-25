import { useListing } from '@agarha/api-client';
import type { PricePeriod } from '@agarha/schemas';
import {
  Badge,
  Button,
  ChipGroup,
  ContactBar,
  DealerCard,
  EmptyState,
  ErrorState,
  FreshnessChip,
  Gallery,
  IconButton,
  InlineAlert,
  ListingCardSkeleton,
  RequirementList,
  Text,
  useUi,
} from '@agarha/ui-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Flag, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { FavoriteButton } from '@/components/favorite-button';
import { SearchResultCard } from '@/components/search-result-card';
import { track } from '@/lib/analytics';
import { useContact } from '@/lib/contact';
import { listingShareUrl } from '@/lib/links';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListing(id);
  const t = useTranslations('web.listing');
  const tu = useTranslations('ui');
  const ts = useTranslations('web.search');
  const format = useFormatter();
  const { locale, colors, ago } = useUi();
  const router = useRouter();
  const [period, setPeriod] = useState<PricePeriod>('day');
  const { contact, busy } = useContact(id ?? '', 'listing_page');
  useEffect(() => {
    if (id) track('listing_viewed', { listing_id: id, source: 'app' });
  }, [id]);

  if (q.isPending)
    return (
      <View className="flex-1 bg-page p-4">
        <ListingCardSkeleton />
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View className="flex-1 bg-page p-4">
        {(q.error as { status?: number } | null)?.status === 404 ? (
          <EmptyState title={t('notFoundTitle')} body={t('notFoundBody')} />
        ) : (
          <ErrorState body={ts('errorBody')} onRetry={() => void q.refetch()} />
        )}
      </View>
    );

  const { listing, card, dealer, similar } = q.data;
  const name = `${card.make[locale]} ${card.model[locale]} ${card.year}`;
  const photos = listing.photos
    .filter((p) => p.status === 'ready' && p.urls?.webp)
    .map((p) => ({
      id: p.id,
      src: p.urls!.webp!['1280'] ?? p.urls!.webp!['640'] ?? '',
      blurhash: p.blurhash,
    }));
  const description = locale === 'ar' ? listing.descriptionAr : listing.descriptionEn;
  const facts: [string, string][] = [
    [t('year'), String(listing.year)],
    [t('transmission'), listing.transmission === 'automatic' ? tu('automatic') : tu('manual')],
    [t('fuel'), t(`fuels.${listing.fuel}` as never)],
    [t('seats'), String(listing.seats)],
    [t('color'), listing.color],
    [
      t('driverOption'),
      listing.driverOption === 'self'
        ? tu('selfDrive')
        : listing.driverOption === 'driver'
          ? tu('withDriver')
          : tu('selfOrDriver'),
    ],
    ...(listing.deliveryOptions.length
      ? [
          [
            t('delivery'),
            listing.deliveryOptions.map((d) => t(`deliveryOptions.${d}` as never)).join('، '),
          ] as [string, string],
        ]
      : []),
  ];
  const share = async () => {
    track('listing_shared', { listing_id: card.id });
    const url = listingShareUrl(locale, card.id, card.slug);
    await Share.share({ message: `${name} — ${url}`, url });
  };

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View className="flex-row gap-1">
              <IconButton
                label={t('share')}
                icon={<Share2 size={22} color={colors.textPrimary} strokeWidth={1.75} />}
                onPress={() => void share()}
              />
              <FavoriteButton listingId={card.id} card={card} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerClassName="pb-6">
        <Gallery photos={photos} alt={name} />
        <View className="gap-6 p-4">
          <View className="gap-2">
            <Text variant="h1" accessibilityRole="header">
              {name}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {card.featured ? <Badge kind="featured" /> : null}
              {card.dealer.verified ? <Badge kind="verified" /> : null}
              <FreshnessChip lastConfirmedAt={card.lastConfirmedAt} />
            </View>
            <Text variant="caption" tone="secondary">
              {t('lastConfirmed', { ago: ago(card.lastConfirmedAt) })}
            </Text>
          </View>
          {!card.available ? (
            <InlineAlert tone="warning">{t('unavailableNotice')}</InlineAlert>
          ) : null}
          <ChipGroup
            label={ts('period')}
            single
            value={[period]}
            onChange={(v) => setPeriod((v[0] as PricePeriod) ?? 'day')}
            options={[
              { value: 'day', label: ts('periodDay') },
              { value: 'week', label: ts('periodWeek') },
              { value: 'month', label: ts('periodMonth') },
            ]}
          />

          <View className="gap-3">
            <Text variant="h2">{t('requirements')}</Text>
            <RequirementList
              deposit={card.prices.deposit}
              minAge={card.minAge}
              requiredDocs={card.requiredDocs}
              kmLimitPerDay={card.kmLimitPerDay}
              airportPickup={card.airportPickup}
            />
          </View>
          <InlineAlert tone="warning" title={t('safetyTitle')}>
            {t('safetyBody')}
          </InlineAlert>

          <View className="gap-2">
            <Text variant="h2">{t('facts')}</Text>
            {facts.map(([k, v]) => (
              <View key={k} className="flex-row justify-between gap-4 border-b border-border py-2">
                <Text tone="secondary">{k}</Text>
                <Text className="shrink">{v}</Text>
              </View>
            ))}
          </View>

          {description ? (
            <View className="gap-2">
              <Text variant="h2">{t('description')}</Text>
              <Text>{description}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <Text variant="h2">{t('dealer')}</Text>
            <DealerCard
              name={locale === 'ar' ? dealer.nameAr : dealer.nameEn}
              onPress={() => router.push(`/dealers/${dealer.slug}`)}
              verified={dealer.verified}
              area={card.area[locale]}
              reviews={dealer.reviews}
              responseRate={dealer.responseRate}
              responseRateLabel={
                dealer.responseRate === null
                  ? ''
                  : t('responseRate', { percent: Math.round(dealer.responseRate * 100) })
              }
              memberSinceLabel={t('memberSince', {
                date: format.dateTime(new Date(dealer.memberSince), {
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            />
          </View>

          <Button variant="secondary" onPress={() => router.push(`/availability/${card.id}`)}>
            {t('requestAvailability')}
          </Button>
          <Text variant="caption" tone="secondary">
            {t('priceNote')}
          </Text>
          <Link href={`/report/${card.id}`} className="min-h-touch py-3" accessibilityRole="link">
            <View className="flex-row items-center gap-2">
              <Flag size={16} color={colors.statusDanger} strokeWidth={1.75} />
              <Text tone="danger">{t('report')}</Text>
            </View>
          </Link>

          {similar.length ? (
            <View className="gap-3">
              <Text variant="h2">{t('similar')}</Text>
              {similar.slice(0, 4).map((c) => (
                <SearchResultCard key={c.id} card={c} period={period} source="similar" />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <ContactBar
        prices={card.prices}
        period={period}
        onContact={(c) => void contact(c)}
        contacting={busy}
      />
    </View>
  );
}
