import { useCities, useSearch } from '@agarha/api-client';
import { CAR_BODY_TYPES } from '@agarha/schemas/enums';
import { Button, ChipGroup, InlineAlert, ListingCardSkeleton, Text, useUi } from '@agarha/ui-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { FavoriteButton } from '@/components/favorite-button';
import { Screen } from '@/components/screen';
import { SearchResultCard } from '@/components/search-result-card';
import { track } from '@/lib/analytics';
import { addRecent, prefs, type RecentSearch } from '@/lib/storage';

export default function Explore() {
  const t = useTranslations();
  const { locale } = useUi();
  const router = useRouter();
  const cities = useCities();
  const [city, setCity] = useState('cairo');
  const [type, setType] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const featured = useSearch({ city, limit: 4 });
  useFocusEffect(
    useCallback(() => {
      void prefs.get<RecentSearch[]>('recent', []).then(setRecent);
    }, []),
  );
  const cityName = (slug: string) => {
    const c = cities.data?.find((x) => x.slug === slug);
    return c ? (locale === 'ar' ? c.nameAr : c.nameEn) : slug;
  };
  const go = async (r: RecentSearch) => {
    track('search_submitted', { city: r.city, type: r.type ?? null, source: 'explore' });
    setRecent(await addRecent(r));
    router.push({ pathname: '/search', params: { city: r.city, ...(r.type ? { type: r.type } : {}) } });
  };
  const cards = featured.data?.pages[0]?.items ?? [];
  return (
    <Screen>
      <View className="gap-2">
        <Text variant="h1" accessibilityRole="header">{t('web.home.title')}</Text>
        <Text tone="secondary">{t('web.home.subtitle')}</Text>
      </View>

      <View className="gap-4 rounded-lg border border-border bg-card p-4">
        <ChipGroup label={t('web.home.city')} single value={[city]} onChange={(v) => v[0] && setCity(v[0])} options={(cities.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.slug, label: locale === 'ar' ? c.nameAr : c.nameEn }))} />
        <ChipGroup label={t('web.home.type')} single value={type} onChange={setType} options={CAR_BODY_TYPES.map((b) => ({ value: b, label: t(`ui.bodyTypes.${b}`) }))} />
        <Button block onPress={() => void go({ city, label: cityName(city), ...(type[0] ? { type: type[0] } : {}) })}>
          {t('web.home.cta')}
        </Button>
      </View>

      {recent.length ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="h2">{t('app.explore.recent')}</Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                void prefs.set('recent', []);
                setRecent([]);
              }}
            >
              {t('app.explore.clearRecent')}
            </Button>
          </View>
          {recent.map((r) => (
            <Pressable key={`${r.city}-${r.type ?? ''}`} accessibilityRole="link" onPress={() => void go(r)} className="min-h-touch justify-center rounded-md border border-border bg-card px-4">
              <Text>{r.type ? `${cityName(r.city)} · ${t(`ui.bodyTypes.${r.type}`)}` : cityName(r.city)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text variant="h2">{t('app.explore.featured')}</Text>
        {featured.isPending ? <ListingCardSkeleton /> : null}
        {cards.map(({ card }) => (
          <SearchResultCard key={card.id} card={card} source="explore" favorite={<FavoriteButton listingId={card.id} card={card} />} />
        ))}
        <Button variant="secondary" onPress={() => void go({ city, label: cityName(city) })}>
          {t('web.home.browseAll')}
        </Button>
      </View>

      <InlineAlert tone="info" title={t('web.listing.safetyTitle')}>
        {t('web.listing.safetyBody')}
      </InlineAlert>
    </Screen>
  );
}
