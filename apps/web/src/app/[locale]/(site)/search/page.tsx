import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { SearchView } from '@/components/search-view';
import { apiInternal } from '@/lib/env';
import { paramsFrom, SEARCH_PAGE_SIZE } from '@/lib/search-params';
import { serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.search');
  // Result pages are infinite combinations: noindex, follow (SEO lives on city/area/type pages).
  return { title: t('title'), robots: { index: false, follow: true } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') sp.set(k, v);
  const query = paramsFrom(sp);
  const [citiesRes, initial] = await Promise.all([
    serverApi.cities(),
    serverApi
      .search({
        ...(query as Record<string, string | number | undefined>),
        limit: SEARCH_PAGE_SIZE,
      })
      .catch(() => null),
  ]);
  const cities = citiesRes?.items ?? [];
  const areasByCity: Record<string, { slug: string; nameAr: string; nameEn: string }[]> = {};
  await Promise.all(
    cities.map(async (c) => {
      const r = await fetch(`${apiInternal}/v1/catalog/cities/${c.slug}`, {
        next: { revalidate: 300 },
      }).catch(() => null);
      areasByCity[c.slug] = r?.ok
        ? ((await r.json()) as { areas: { slug: string; nameAr: string; nameEn: string }[] }).areas
        : [];
    }),
  );
  return (
    <Suspense>
      <SearchView cities={cities} areasByCity={areasByCity} initial={initial} />
    </Suspense>
  );
}
