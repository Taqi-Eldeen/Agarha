import type { MetadataRoute } from 'next';
import { LEGAL_DOCS } from '@agarha/i18n';
import { siteUrl } from '@/lib/seo';
import { serverApi } from '@/lib/server-api';

export const revalidate = 3600;

/** One entry per page with ar/en hreflang alternates. Search result pages are excluded (noindex). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await serverApi.sitemap();
  const entry = (
    path: string,
    lastModified?: string,
    priority = 0.6,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}/ar${path}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    priority,
    alternates: { languages: { ar: `${siteUrl}/ar${path}`, en: `${siteUrl}/en${path}` } },
  });
  const out: MetadataRoute.Sitemap = [
    entry('', undefined, 1),
    entry('/dealers', undefined, 0.7),
    entry('/for-dealers', undefined, 0.5),
    entry('/help', undefined, 0.4),
    ...LEGAL_DOCS.map((d) => entry(`/legal/${d}`, undefined, 0.2)),
  ];
  if (!data) return out;
  for (const c of data.cities) out.push(entry(`/${c}`, undefined, 0.9));
  for (const a of data.areas) out.push(entry(`/${a.city}/${a.area}`, undefined, 0.8));
  for (const ty of data.types) out.push(entry(`/${ty.city}/${ty.type}`, undefined, 0.8));
  for (const l of data.listings) out.push(entry(`/cars/${l.id}-${l.slug}`, l.updatedAt, 0.7));
  for (const d of data.dealers) out.push(entry(`/dealers/${d.slug}`, d.updatedAt, 0.6));
  return out;
}
