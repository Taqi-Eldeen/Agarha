import 'server-only';
import type {
  DealerProfile,
  Landing,
  ListingDetail,
  SearchResult,
  SitemapData,
} from '@agarha/schemas';
import { apiInternal } from './env';

/** Server-side GET with ISR (public reads are cacheable for 60s, section 6). */
async function get<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${apiInternal}/v1${path}`, {
      next: { revalidate },
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null; // API may not be reachable during `next build`
    throw err;
  }
}

export const serverApi = {
  cities: () =>
    get<{ items: { id: string; slug: string; nameAr: string; nameEn: string }[] }>(
      '/catalog/cities',
      300,
    ),
  bodyTypes: () => get<{ items: string[] }>('/catalog/body-types', 3600),
  search: (q: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(q).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString();
    return get<SearchResult>(`/search?${qs}`);
  },
  listing: (id: string) => get<ListingDetail>(`/listings/${encodeURIComponent(id)}`),
  dealer: (slug: string) => get<DealerProfile>(`/dealers/${encodeURIComponent(slug)}`),
  dealers: (city?: string) =>
    get<{
      items: {
        id: string;
        slug: string;
        nameAr: string;
        nameEn: string;
        branchCount: number;
        reviews: { count: number; average: number | null };
      }[];
      nextCursor: string | null;
    }>(`/dealers${city ? `?city=${city}` : ''}`),
  landing: (city: string, q: { area?: string; type?: string } = {}) =>
    get<Landing>(
      `/landing/${encodeURIComponent(city)}?${new URLSearchParams(q as Record<string, string>)}`,
      300,
    ),
  sitemap: () => get<SitemapData>('/seo/sitemap', 3600),
};
