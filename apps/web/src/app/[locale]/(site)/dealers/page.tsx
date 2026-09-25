import { BadgeCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@agarha/ui-web';
import { Link } from '@/i18n/routing';
import { alternates } from '@/lib/seo';
import { serverApi } from '@/lib/server-api';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'web.dealerPage' });
  return { title: t('title'), description: t('subtitle'), alternates: alternates(locale, '/dealers') };
}

export default async function Dealers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ city?: string }> }) {
  const { locale } = await params;
  const { city } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('web.dealerPage');
  const tu = await getTranslations('ui');
  const [dealers, cities] = await Promise.all([serverApi.dealers(city), serverApi.cities()]);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-fg-secondary">{t('subtitle')}</p>
      </header>
      <nav className="flex flex-wrap gap-2">
        {(cities?.items ?? []).map((c) => (
          <Link key={c.slug} href={`/dealers?city=${c.slug}`} aria-current={city === c.slug ? 'page' : undefined} className="inline-flex min-h-touch items-center rounded-full border border-border px-4 aria-[current=page]:border-brand aria-[current=page]:bg-brand-subtle">
            {locale === 'ar' ? c.nameAr : c.nameEn}
          </Link>
        ))}
      </nav>
      {dealers?.items.length ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dealers.items.map((d) => (
            <li key={d.id}>
              <Link href={`/dealers/${d.slug}`} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 hover:shadow-1">
                <span className="flex items-center gap-2 font-semibold">
                  {locale === 'ar' ? d.nameAr : d.nameEn}
                  <BadgeCheck aria-label={tu('verified')} className="size-5 text-brand" strokeWidth={1.75} />
                </span>
                {d.reviews.count ? <span className="text-caption">{`★ ${d.reviews.average} · ${tu('reviewsCount', { count: d.reviews.count })}`}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState body={t('emptyDirectory')} />
      )}
    </div>
  );
}
