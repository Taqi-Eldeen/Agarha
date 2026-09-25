import { useApi, useSearch, type SearchParams } from '@agarha/api-client';
import type { PricePeriod } from '@agarha/schemas';
import {
  Button,
  ChipGroup,
  BottomSheet,
  EmptyState,
  ErrorState,
  FilterChip,
  ListingCardSkeleton,
  Text,
  TextField,
  useToast,
  useUi,
} from '@agarha/ui-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { FavoriteButton } from '@/components/favorite-button';
import { SearchResultCard } from '@/components/search-result-card';
import { track } from '@/lib/analytics';
import { paramsFrom } from '@/lib/search-params';
import { useSession } from '@/lib/session';

type Sort = NonNullable<SearchParams['sort']>;
type Filters = Pick<
  SearchParams,
  'transmission' | 'priceMax' | 'seatsMin' | 'driver' | 'airport' | 'sort'
>;

export default function Search() {
  const t = useTranslations('web.search');
  const tu = useTranslations('ui');
  const { colors } = useUi();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { signedIn } = useSession();
  const initial = paramsFrom(useLocalSearchParams());
  const [period, setPeriod] = useState<PricePeriod>(initial.period ?? 'day');
  const [filters, setFilters] = useState<Filters>({
    ...(initial.transmission ? { transmission: initial.transmission } : {}),
    ...(initial.priceMax ? { priceMax: initial.priceMax } : {}),
    ...(initial.seatsMin ? { seatsMin: initial.seatsMin } : {}),
    ...(initial.airport ? { airport: true } : {}),
    ...(initial.sort ? { sort: initial.sort } : {}),
  });
  const [draft, setDraft] = useState<Filters>(filters);
  const [open, setOpen] = useState(false);
  const params = useMemo<SearchParams>(
    () => ({
      city: initial.city,
      area: initial.area,
      type: initial.type,
      make: initial.make,
      q: initial.q,
      period,
      ...filters,
    }),
    [initial.city, initial.area, initial.type, initial.make, initial.q, period, filters],
  );
  const q = useSearch(params);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total;
  const active = Object.entries(filters).filter(([, v]) => v !== undefined && v !== false);

  const saveSearch = async () => {
    if (!signedIn) return router.push('/sign-in');
    try {
      await api.POST('/v1/me/saved-searches', {
        body: {
          name: [initial.city, initial.type].filter(Boolean).join(' · ') || t('title'),
          query: params as never,
        },
      });
      track('search_saved', { city: initial.city ?? null });
      toast({ tone: 'success', text: t('savedToast') });
    } catch {
      toast({ tone: 'danger', text: t('errorBody') });
    }
  };

  const header = (
    <View className="gap-3 pb-3">
      {total !== undefined ? (
        <Text tone="secondary" accessibilityLiveRegion="polite">
          {t('results', { count: total })}
        </Text>
      ) : null}
      <ChipGroup
        label={t('period')}
        single
        value={[period]}
        onChange={(v) => setPeriod((v[0] as PricePeriod) ?? 'day')}
        options={[
          { value: 'day', label: t('periodDay') },
          { value: 'week', label: t('periodWeek') },
          { value: 'month', label: t('periodMonth') },
        ]}
      />
      <View className="flex-row flex-wrap gap-2">
        <FilterChip
          label={t('filters')}
          icon={<SlidersHorizontal size={16} color={colors.textPrimary} strokeWidth={1.75} />}
          onToggle={() => {
            setDraft(filters);
            setOpen(true);
          }}
        />
        {active.map(([k]) => (
          <FilterChip
            key={k}
            label={chipLabel(k as keyof Filters)}
            onRemove={() =>
              setFilters((f) => {
                const next = { ...f };
                delete next[k as keyof Filters];
                return next;
              })
            }
          />
        ))}
      </View>
      <Button size="sm" variant="ghost" onPress={() => void saveSearch()}>
        {t('saveSearch')}
      </Button>
    </View>
  );

  function chipLabel(k: keyof Filters): string {
    if (k === 'transmission')
      return filters.transmission === 'automatic' ? tu('automatic') : tu('manual');
    if (k === 'priceMax') return `${t('priceMax')} ${filters.priceMax}`;
    if (k === 'seatsMin') return t('seatsMin', { count: filters.seatsMin ?? 0 });
    if (k === 'airport') return t('airport');
    if (k === 'sort')
      return t(
        filters.sort === 'price_asc'
          ? 'sortPriceAsc'
          : filters.sort === 'price_desc'
            ? 'sortPriceDesc'
            : 'sortNewest',
      );
    return t('filters');
  }

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ title: t('title') }} />
      <FlashList
        data={items}
        keyExtractor={(i) => i.card.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <SearchResultCard
            card={item.card}
            period={period}
            source="search"
            favorite={<FavoriteButton listingId={item.card.id} card={item.card} />}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListEmptyComponent={
          q.isPending ? (
            <View className="gap-4">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </View>
          ) : q.isError ? (
            <ErrorState body={t('errorBody')} onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState
              title={t('emptyTitle')}
              body={t('emptyBody')}
              action={
                active.length ? (
                  <Button variant="secondary" onPress={() => setFilters({})}>
                    {t('clearAll')}
                  </Button>
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ListingCardSkeleton /> : null}
      />
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('filters')}
        footer={
          <View className="flex-row gap-2">
            <Button variant="secondary" onPress={() => setDraft({})}>
              {t('clearAll')}
            </Button>
            <Button
              className="flex-1"
              onPress={() => {
                setFilters(draft);
                setOpen(false);
                track('filters_applied', { count: Object.keys(draft).length });
              }}
            >
              {t('filters')}
            </Button>
          </View>
        }
      >
        <ChipGroup
          label={t('sort')}
          single
          value={draft.sort ? [draft.sort] : []}
          onChange={(v) => setDraft({ ...draft, sort: v[0] as Sort | undefined })}
          options={[
            { value: 'price_asc', label: t('sortPriceAsc') },
            { value: 'price_desc', label: t('sortPriceDesc') },
            { value: 'newest', label: t('sortNewest') },
          ]}
        />
        <ChipGroup
          label={t('transmission')}
          single
          value={draft.transmission ? [draft.transmission] : []}
          onChange={(v) =>
            setDraft({ ...draft, transmission: v[0] as 'automatic' | 'manual' | undefined })
          }
          options={[
            { value: 'automatic', label: tu('automatic') },
            { value: 'manual', label: tu('manual') },
          ]}
        />
        <ChipGroup
          label={t('seats')}
          single
          value={draft.seatsMin ? [String(draft.seatsMin)] : []}
          onChange={(v) => setDraft({ ...draft, seatsMin: v[0] ? Number(v[0]) : undefined })}
          options={['4', '5', '7'].map((n) => ({
            value: n,
            label: t('seatsMin', { count: Number(n) }),
          }))}
        />
        <TextField
          label={`${t('price')} · ${t('priceMax')}`}
          keyboardType="number-pad"
          value={draft.priceMax ? String(draft.priceMax) : ''}
          onChangeText={(v) =>
            setDraft({ ...draft, priceMax: Number(v.replace(/\D/g, '')) || undefined })
          }
          optional
        />
        <ChipGroup
          label={t('airport')}
          value={draft.airport ? ['yes'] : []}
          onChange={(v) => setDraft({ ...draft, airport: v.includes('yes') || undefined })}
          options={[{ value: 'yes', label: t('airport') }]}
        />
      </BottomSheet>
    </View>
  );
}

function Gap() {
  return <View style={{ height: 16 }} />;
}
