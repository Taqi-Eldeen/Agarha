import { formatEgp } from '@agarha/i18n';
import type { Landing } from '@agarha/schemas';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { landingIntro, landingTitle } from '@/lib/landing';
import { listingPath } from '@/lib/listing-url';
import { JsonLdScript, siteUrl } from '@/lib/seo';
import { ContactableCard } from './contact-actions';
import { FavoriteButton } from './favorite-button';

/** SEO landing: city / area / car type. Server-rendered, with an ItemList of the cars shown. */
export async function LandingView({ locale, data }: { locale: 'ar' | 'en'; data: Landing }) {
  const t = await getTranslations('web.landing');
  const tu = await getTranslations('ui');
  const title = landingTitle(locale, data);
  const searchHref = `/search?city=${data.city.slug}${data.area ? `&area=${data.area.slug}` : ''}${data.type ? `&type=${data.type}` : ''}`;
  return (
    <div className="flex flex-col gap-8">
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: title,
          itemListElement: data.listings.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${siteUrl}/${locale}${listingPath(c)}`,
          })),
        }}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">{title}</h1>
        <p className="text-fg-secondary">{landingIntro(locale, data)}</p>
        {data.stats.median ? (
          <p className="text-caption text-fg-secondary">
            {t('median', { price: formatEgp(data.stats.median, locale) })}
          </p>
        ) : null}
      </header>
      {data.listings.length ? (
        <section>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.listings.map((card, i) => (
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
          <Link
            href={searchHref}
            className="mt-4 inline-flex min-h-touch items-center font-medium text-brand hover:underline"
          >
            {t('seeAll', { count: data.total })}
          </Link>
        </section>
      ) : null}
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-h2">{t('areas')}</h2>
          <ul className="flex flex-wrap gap-2">
            {data.areas.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/${data.city.slug}/${a.slug}`}
                  className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border bg-card px-4 hover:bg-brand-subtle"
                >
                  {locale === 'ar' ? a.nameAr : a.nameEn}
                  <span className="ag-tabular text-caption text-fg-secondary">{a.listings}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-h2">{t('types')}</h2>
          <ul className="flex flex-wrap gap-2">
            {data.types.map((ty) => (
              <li key={ty.type}>
                <Link
                  href={`/${data.city.slug}/${ty.type}`}
                  className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border bg-card px-4 hover:bg-brand-subtle"
                >
                  {tu(`bodyTypes.${ty.type}`)}
                  <span className="ag-tabular text-caption text-fg-secondary">{ty.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
