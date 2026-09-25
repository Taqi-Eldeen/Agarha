'use client';
import { useMapPins, useSearch, type SearchParams } from '@agarha/api-client';
import type { PricePeriod, SearchResult } from '@agarha/schemas';
import { CAR_BODY_TYPES } from '@agarha/schemas/enums';
import {
  Button,
  ChipGroup,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  ListingCard,
  ListingCardSkeleton,
  Select,
  TextField,
  useToast,
  useUi,
} from '@agarha/ui-web';
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { paramsFrom, SEARCH_PAGE_SIZE } from '@/lib/search-params';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi, useMe } from '@agarha/api-client';
import { usePathname, useRouter } from '@/i18n/routing';
import { track } from '@/lib/analytics';
import { env } from '@/lib/env';
import { listingPath } from '@/lib/listing-url';
import { useContact } from './contact-actions';
import { FavoriteButton } from './favorite-button';

// Maps load on demand only (risk #7).
const MapView = dynamic(() => import('@agarha/ui-web/map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-lg bg-brand-subtle" />,
});

type AreaOpt = { slug: string; nameAr: string; nameEn: string };

export function SearchView({
  areasByCity,
  cities,
  initial,
}: {
  areasByCity: Record<string, AreaOpt[]>;
  cities: { slug: string; nameAr: string; nameEn: string }[];
  /** First page rendered on the server for these exact params (no empty-then-pop-in on load). */
  initial?: SearchResult | null;
}) {
  const t = useTranslations('web.search');
  const tu = useTranslations('ui');
  const th = useTranslations('web.home');
  const { locale } = useUi();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => paramsFrom(new URLSearchParams(sp.toString())), [sp]);
  const period = (params.period ?? 'day') as PricePeriod;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [pendingBbox, setPendingBbox] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The server-rendered page only seeds the query for the params it was rendered with.
  const [initialKey] = useState(() => JSON.stringify(params));
  const q = useSearch(
    { ...params, limit: SEARCH_PAGE_SIZE },
    true,
    initial && JSON.stringify(params) === initialKey ? initial : undefined,
  );
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1280px)');
    setWide(m.matches);
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const showMap = wide || view === 'map';
  const pins = useMapPins(params, showMap);

  useEffect(() => {
    track('search_performed', {
      city: params.city,
      type: params.type,
      period,
      has_query: !!params.q,
    });
  }, [params.city, params.type, params.q, period]);

  const set = (
    patch: Partial<Record<keyof SearchParams, string | number | boolean | undefined>>,
  ) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    }
    next.delete('cursor');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const cityName = (slug: string | undefined) =>
    cities.find((c) => c.slug === slug)?.[locale === 'ar' ? 'nameAr' : 'nameEn'];
  const areas = params.city ? (areasByCity[params.city] ?? []) : [];

  const applied: { key: keyof SearchParams; label: string }[] = [
    ...(params.area
      ? [
          {
            key: 'area' as const,
            label:
              areas.find((a) => a.slug === params.area)?.[locale === 'ar' ? 'nameAr' : 'nameEn'] ??
              params.area,
          },
        ]
      : []),
    ...(params.type ? [{ key: 'type' as const, label: tu(`bodyTypes.${params.type}`) }] : []),
    ...(params.transmission
      ? [{ key: 'transmission' as const, label: tu(params.transmission) }]
      : []),
    ...(params.seatsMin
      ? [{ key: 'seatsMin' as const, label: t('seatsMin', { count: params.seatsMin }) }]
      : []),
    ...(params.driver
      ? [
          {
            key: 'driver' as const,
            label:
              params.driver === 'self'
                ? tu('selfDrive')
                : params.driver === 'driver'
                  ? tu('withDriver')
                  : tu('selfOrDriver'),
          },
        ]
      : []),
    ...(params.airport ? [{ key: 'airport' as const, label: t('airport') }] : []),
    ...(params.priceMin
      ? [{ key: 'priceMin' as const, label: `${t('priceMin')} ${params.priceMin}` }]
      : []),
    ...(params.priceMax
      ? [{ key: 'priceMax' as const, label: `${t('priceMax')} ${params.priceMax}` }]
      : []),
    ...(params.q ? [{ key: 'q' as const, label: `“${params.q}”` }] : []),
  ];

  const filters = (
    <div className="flex flex-col gap-5">
      <Select
        label={t('area')}
        value={params.area ?? 'all'}
        onValueChange={(v) => set({ area: v === 'all' ? undefined : v })}
        options={[
          { value: 'all', label: t('anyArea') },
          ...areas.map((a) => ({ value: a.slug, label: locale === 'ar' ? a.nameAr : a.nameEn })),
        ]}
        disabled={!areas.length}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('priceMin')}
          inputMode="numeric"
          defaultValue={params.priceMin ?? ''}
          onBlur={(e) => set({ priceMin: e.target.value || undefined })}
        />
        <TextField
          label={t('priceMax')}
          inputMode="numeric"
          defaultValue={params.priceMax ?? ''}
          onBlur={(e) => set({ priceMax: e.target.value || undefined })}
        />
      </div>
      <Group label={t('transmission')}>
        <ChipGroup
          label={t('transmission')}
          single
          value={params.transmission ? [params.transmission] : []}
          onChange={(v) => set({ transmission: v[0] })}
          options={[
            { value: 'automatic', label: tu('automatic') },
            { value: 'manual', label: tu('manual') },
          ]}
        />
      </Group>
      <Group label={t('seats')}>
        <ChipGroup
          label={t('seats')}
          single
          value={params.seatsMin ? [String(params.seatsMin)] : []}
          onChange={(v) => set({ seatsMin: v[0] })}
          options={['4', '5', '7', '9'].map((n) => ({
            value: n,
            label: t('seatsMin', { count: n }),
          }))}
        />
      </Group>
      <Group label={t('driver')}>
        <ChipGroup
          label={t('driver')}
          single
          value={params.driver ? [params.driver] : []}
          onChange={(v) => set({ driver: v[0] })}
          options={[
            { value: 'self', label: tu('selfDrive') },
            { value: 'driver', label: tu('withDriver') },
          ]}
        />
      </Group>
      <Group label={th('type')}>
        <ChipGroup
          label={th('type')}
          value={params.type ? [params.type] : []}
          single
          onChange={(v) => set({ type: v[0] })}
          options={CAR_BODY_TYPES.map((b) => ({ value: b, label: tu(`bodyTypes.${b}`) }))}
        />
      </Group>
      <label className="flex min-h-touch items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-[rgb(var(--ag-color-brand-primary))]"
          checked={!!params.airport}
          onChange={(e) => set({ airport: e.target.checked || undefined })}
        />
        {t('airport')}
      </label>
      <label className="flex min-h-touch items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-[rgb(var(--ag-color-brand-primary))]"
          checked={sp.get('includeUnavailable') === 'true'}
          onChange={(e) => set({ includeUnavailable: e.target.checked || undefined } as never)}
        />
        {t('includeUnavailable')}
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">
            {params.city
              ? t('titleIn', { place: cityName(params.city) ?? params.city })
              : t('title')}
          </h1>
          <p className="text-fg-secondary" aria-live="polite">
            {q.isSuccess ? t('results', { count: total }) : ' '}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label={t('sort')}
            value={params.sort ?? 'relevance'}
            onValueChange={(v) => set({ sort: v === 'relevance' ? undefined : v })}
            options={[
              { value: 'relevance', label: t('sortRelevance') },
              { value: 'price_asc', label: t('sortPriceAsc') },
              { value: 'price_desc', label: t('sortPriceDesc') },
              { value: 'newest', label: t('sortNewest') },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          className="lg:hidden"
          icon={<SlidersHorizontal aria-hidden className="size-5" strokeWidth={1.75} />}
          onClick={() => setFiltersOpen(true)}
        >
          {t('filters')}
        </Button>
        <ChipGroup
          label={t('period')}
          single
          value={[period]}
          onChange={(v) => set({ period: v[0] === 'day' ? undefined : v[0] })}
          options={[
            { value: 'day', label: t('periodDay') },
            { value: 'week', label: t('periodWeek') },
            { value: 'month', label: t('periodMonth') },
          ]}
        />
        <div className="ms-auto flex gap-2 xl:hidden">
          <Button
            size="sm"
            variant={view === 'list' ? 'primary' : 'secondary'}
            onClick={() => setView('list')}
            icon={<List aria-hidden className="size-4" />}
          >
            {t('list')}
          </Button>
          <Button
            size="sm"
            variant={view === 'map' ? 'primary' : 'secondary'}
            onClick={() => setView('map')}
            icon={<MapIcon aria-hidden className="size-4" />}
          >
            {t('map')}
          </Button>
        </div>
      </div>

      {applied.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {applied.map((a) => (
            <FilterChip key={a.key} label={a.label} onRemove={() => set({ [a.key]: undefined })} />
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.replace(params.city ? `/search?city=${params.city}` : '/search')}
          >
            {t('clearAll')}
          </Button>
          <SaveSearch params={params} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_minmax(0,28rem)]">
        <aside aria-label={t('filters')} className="hidden lg:block">
          <div className="sticky top-24">{filters}</div>
        </aside>
        <section aria-label={t('title')} className={view === 'map' && !wide ? 'hidden' : ''}>
          {q.isError ? (
            <ErrorState body={t('errorBody')} onRetry={() => void q.refetch()} />
          ) : q.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={t('emptyTitle')}
              body={t('emptyBody')}
              action={
                <Button variant="secondary" onClick={() => router.replace('/search')}>
                  {t('clearAll')}
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2">
                {items.map(({ card }, i) => (
                  <li key={card.id} onMouseEnter={() => setSelected(card.id)}>
                    <ResultCard card={card} period={period} priority={i < 2} />
                  </li>
                ))}
              </ul>
              {q.hasNextPage ? (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="secondary"
                    loading={q.isFetchingNextPage}
                    onClick={() => void q.fetchNextPage()}
                  >
                    {t('loadMore')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
        {showMap ? (
          <section
            aria-label={t('map')}
            className="relative h-[70dvh] xl:sticky xl:top-24 xl:h-[calc(100dvh-8rem)]"
          >
            <MapView
              pins={pins.data ?? []}
              styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL}
              selectedId={selected}
              onSelect={(id) =>
                router.push(
                  listingPath({
                    id,
                    slug: items.find((i) => i.card.id === id)?.card.slug ?? 'car',
                  }),
                )
              }
              onMoveEnd={(b) => setPendingBbox(b.map((n) => n.toFixed(4)).join(','))}
              className="size-full rounded-lg"
            />
            {pendingBbox && pendingBbox !== params.bbox ? (
              <Button
                size="sm"
                className="absolute start-1/2 top-3 -translate-x-1/2 shadow-2 rtl:translate-x-1/2"
                onClick={() => set({ bbox: pendingBbox })}
              >
                {t('searchThisArea')}
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>

      <Drawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('filters')}
        footer={
          <Button block onClick={() => setFiltersOpen(false)}>
            {t('showResults', { count: total })}
          </Button>
        }
      >
        {filters}
      </Drawer>
    </div>
  );
}

function ResultCard({
  card,
  period,
  priority,
}: {
  card: Parameters<typeof ListingCard>[0]['card'];
  period: PricePeriod;
  priority: boolean;
}) {
  const { contact, busy } = useContact(card.id, 'search');
  return (
    <ListingCard
      card={card}
      href={`/${useUi().locale}${listingPath(card)}`}
      period={period}
      onContact={contact}
      contacting={busy}
      priority={priority}
      favorite={<FavoriteButton card={card} />}
    />
  );
}

function SaveSearch({ params }: { params: SearchParams }) {
  const t = useTranslations('web.search');
  const me = useMe();
  const api = useApi();
  const toast = useToast();
  const router = useRouter();
  const {
    cursor: _c,
    limit: _l,
    sort: _s,
    ...query
  } = params as SearchParams & { cursor?: string };
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        if (!me.data)
          return router.push(
            `/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
        await api.POST('/v1/me/saved-searches', {
          body: { query: query as never, alertsEnabled: true },
        });
        track('saved_search_created', {});
        toast({ tone: 'success', text: t('savedToast') });
      }}
    >
      {t('saveSearch')}
    </Button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden className="font-medium">
        {label}
      </p>
      {children}
    </div>
  );
}
