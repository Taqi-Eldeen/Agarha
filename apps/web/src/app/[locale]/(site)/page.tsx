import { CAR_BODY_TYPES } from '@agarha/schemas';
import { BadgeCheck, MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactableCard } from '@/components/contact-actions';
import { FavoriteButton } from '@/components/favorite-button';
import { HomeSearch } from '@/components/home-search';
import { Link } from '@/i18n/routing';
import { listingPath } from '@/lib/listing-url';
import { serverApi } from '@/lib/server-api';

export const revalidate = 60;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('web.home');
  const tu = await getTranslations('ui');
  const loc = (await getLocale()) as 'ar' | 'en';
  const [cities, featured] = await Promise.all([
    serverApi.cities(),
    serverApi.search({ limit: 8 }),
  ]);
  const cityList = cities?.items ?? [];
  const steps = [
    { icon: Search, title: t('how1Title'), body: t('how1Body') },
    { icon: BadgeCheck, title: t('how2Title'), body: t('how2Body') },
    { icon: MessageCircle, title: t('how3Title'), body: t('how3Body') },
  ];
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6 pt-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-display">{t('title')}</h1>
          <p className="mt-3 text-fg-secondary">{t('subtitle')}</p>
        </div>
        <HomeSearch cities={cityList} />
      </section>

      <section aria-labelledby="cities">
        <h2 id="cities" className="mb-4 text-h2">
          {t('popularCities')}
        </h2>
        <ul className="flex flex-wrap gap-3">
          {cityList.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="inline-flex min-h-touch items-center rounded-full border border-border bg-card px-5 hover:bg-brand-subtle"
              >
                {loc === 'ar' ? c.nameAr : c.nameEn}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="types">
        <h2 id="types" className="mb-4 text-h2">
          {t('carTypes')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {CAR_BODY_TYPES.map((b) => (
            <li key={b}>
              <Link
                href={`/${cityList[0]?.slug ?? 'cairo'}/${b}`}
                className="flex min-h-16 items-center justify-center rounded-lg border border-border bg-card p-3 text-center hover:bg-brand-subtle"
              >
                {tu(`bodyTypes.${b}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured && featured.items.length ? (
        <section aria-labelledby="featured">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="featured" className="text-h2">
              {t('featured')}
            </h2>
            <Link href="/search" className="text-brand hover:underline">
              {t('browseAll')}
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {featured.items.map(({ card }, i) => (
              <li key={card.id}>
                <ContactableCard
                  card={card}
                  href={`/${locale}${listingPath(card)}`}
                  priority={i === 0}
                  favorite={<FavoriteButton card={card} />}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="how" className="rounded-lg bg-brand-subtle p-6">
        <h2 id="how" className="mb-6 text-h2">
          {t('howTitle')}
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="ag-tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white dark:text-page">
                {i + 1}
              </span>
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <s.icon aria-hidden className="size-5 text-brand" strokeWidth={1.75} />
                  {s.title}
                </h3>
                <p className="mt-1 text-fg-secondary">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden className="size-8 shrink-0 text-brand" strokeWidth={1.75} />
          <div>
            <h2 className="text-h2">{t('trustTitle')}</h2>
            <p className="text-fg-secondary">{t('trustBody')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
