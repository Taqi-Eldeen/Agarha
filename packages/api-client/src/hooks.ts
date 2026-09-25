import type { LeadResponse, ListingCard, ListingDetail, SearchResult } from '@agarha/schemas';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { idempotencyKey, type ApiClient } from './client';

const Ctx = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return createElement(Ctx.Provider, { value: client }, children);
}

export function useApi(): ApiClient {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApi must be used inside <ApiProvider>');
  return c;
}

export type SearchParams = Partial<{
  city: string;
  area: string;
  type: string;
  make: string;
  q: string;
  period: 'day' | 'week' | 'month';
  priceMin: number;
  priceMax: number;
  transmission: 'automatic' | 'manual';
  seatsMin: number;
  driver: 'self' | 'driver' | 'both';
  airport: boolean;
  lat: number;
  lng: number;
  radiusKm: number;
  bbox: string;
  dealerId: string;
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'distance';
  limit: number;
}>;

export const keys = {
  search: (p: SearchParams): QueryKey => ['search', p],
  pins: (p: SearchParams): QueryKey => ['pins', p],
  listing: (id: string): QueryKey => ['listing', id],
  dealer: (slug: string): QueryKey => ['dealer', slug],
  me: ['me'] as QueryKey,
  favorites: ['favorites'] as QueryKey,
  saved: ['saved-searches'] as QueryKey,
  cities: ['cities'] as QueryKey,
};

/** Infinite, cursor-paginated search results. */
export function useSearch(params: SearchParams, enabled = true, initial?: SearchResult) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.search(params),
    enabled,
    // Server-rendered first page (web): hydrates the cache so results are in the initial HTML.
    ...(initial ? { initialData: { pages: [initial], pageParams: [undefined] }, initialDataUpdatedAt: Date.now() } : {}),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await api.GET('/v1/search', {
        params: { query: { ...params, cursor: pageParam } as never },
        signal,
      });
      return data as SearchResult;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useMapPins(params: SearchParams, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.pins(params),
    enabled,
    queryFn: async ({ signal }) =>
      (await api.GET('/v1/search/map', { params: { query: params as never }, signal })).data!.items,
    staleTime: 30_000,
  });
}

export function useListing(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: keys.listing(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) =>
      (await api.GET('/v1/listings/{id}', { params: { path: { id: id! } }, signal }))
        .data as ListingDetail,
    staleTime: 60_000,
  });
}

export function useDealerProfile(slug: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: keys.dealer(slug ?? ''),
    enabled: !!slug,
    queryFn: async ({ signal }) =>
      (await api.GET('/v1/dealers/{slug}', { params: { path: { slug: slug! } }, signal })).data!,
  });
}

export function useCities() {
  const api = useApi();
  return useQuery({
    queryKey: keys.cities,
    queryFn: async () => (await api.GET('/v1/catalog/cities')).data!.items,
    staleTime: 3_600_000,
  });
}

/**
 * Logs the lead and returns the deep link. The caller opens `url` (wa.me or tel:) immediately.
 * One idempotency key per tap so a retried request never creates a second lead.
 */
export function useContactDealer() {
  const api = useApi();
  return useMutation({
    mutationFn: async (v: {
      listingId: string;
      channel: 'whatsapp' | 'call';
      locale: 'ar' | 'en';
    }) => {
      const { data } = await api.POST('/v1/leads', {
        body: v,
        headers: { 'idempotency-key': idempotencyKey() },
      });
      return data as LeadResponse;
    },
  });
}

export function useMe(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.me,
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return (await api.GET('/v1/me')).data ?? null;
      } catch {
        return null;
      }
    },
  });
}

export function useFavorites(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: keys.favorites,
    enabled,
    queryFn: async () =>
      (await api.GET('/v1/me/favorites/cards')).data as unknown as {
        items: ListingCard[];
        unavailableIds: string[];
      },
  });
}

/** Optimistic favorite toggle. */
export function useToggleFavorite() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listingId,
      on,
    }: {
      listingId: string;
      on: boolean;
      card?: ListingCard;
    }) => {
      if (on) await api.PUT('/v1/me/favorites/{listingId}', { params: { path: { listingId } } });
      else await api.DELETE('/v1/me/favorites/{listingId}', { params: { path: { listingId } } });
    },
    onMutate: async ({ listingId, on, card }) => {
      await qc.cancelQueries({ queryKey: keys.favorites });
      const prev = qc.getQueryData<{ items: ListingCard[]; unavailableIds: string[] }>(
        keys.favorites,
      );
      if (prev)
        qc.setQueryData(keys.favorites, {
          ...prev,
          items: on
            ? card
              ? [card, ...prev.items]
              : prev.items
            : prev.items.filter((c) => c.id !== listingId),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.favorites, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.favorites }),
  });
}
