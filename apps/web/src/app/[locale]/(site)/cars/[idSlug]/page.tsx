import { formatDate, formatEgp, formatRelative } from '@agarha/i18n';
import { Badge, Gallery, InlineAlert, RequirementList } from '@agarha/ui-web';
import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { ListingContactBar } from '@/components/contact-actions';
import { FavoriteButton } from '@/components/favorite-button';
import { ListingViewTracker } from '@/components/listing-view-tracker';
import { ReportButton } from '@/components/report-button';
import { RequestAvailability } from '@/components/request-availability-button';
import { ShareButton } from '@/components/share-button';
import { ContactableCard } from '@/components/contact-actions';
import { Link } from '@/i18n/routing';
import { listingPath, parseListingParam } from '@/lib/listing-url';
import { alternates, JsonLdScript, listingJsonLd, siteUrl } from '@/lib/seo';
import { serverApi } from '@/lib/server-api';

export const revalidate = 60;

type P = { params: Promise<{ locale: string; idSlug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, idSlug } = await params;
  const d = await serverApi.listing(parseListingParam(idSlug));
  if (!d) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: 'web.seo' });
  const l = locale as 'ar' | 'en';
  const car = `${d.card.make[l]} ${d.card.model[l]}`;
  const vars = { car, year: d.card.year, area: d.card.area[l], price: formatEgp(d.card.prices.day, l), deposit: formatEgp(d.card.prices.deposit, l), dealer: l === 'ar' ? d.dealer.nameAr : d.dealer.nameEn };
  const img = d.card.photo?.url640;
  return { title: t('listingTitle', vars), description: t('listingDescription', vars), alternates: alternates(locale, listingPath(d.card)), openGraph: { images: img ? [img] : [] } };
}

export default async function ListingPage({ params }: P) {
  const { locale, idSlug } = await params;
  setRequestLocale(locale);
  const l = locale as 'ar' | 'en';
  const d = await serverApi.listing(parseListingParam(idSlug));
  if (!d) notFound();
  if (idSlug !== `${d.card.id}-${d.card.slug}`) permanentRedirect(`/${locale}${listingPath(d.card)}`);
  const t = await getTranslations('web.listing');
  const tu = await getTranslations('ui');
  const tn = await getTranslations('web.nav');
  const L = d.listing;
  const name = `${d.card.make[l]} ${d.card.model[l]}`;
  const url = `${siteUrl}/${locale}${listingPath(d.card)}`;
  const photos = L.photos.filter((p) => p.urls).map((p) => ({ id: p.id, src: p.urls!.webp!['1280']!, srcSet: `${p.urls!.webp!['640']} 640w, ${p.urls!.webp!['1280']} 1280w`, blurhash: p.blurhash }));
  const facts: [string, string][] = [
    [t('year'), String(L.year)],
    [t('transmission'), tu(L.transmission)],
    [t('fuel'), t(`fuels.${L.fuel}` as 'fuels.petrol')],
    [t('seats'), tu('seats', { count: L.seats })],
    [t('color'), L.color],
    [t('driverOption'), L.driverOption === 'self' ? tu('selfDrive') : L.driverOption === 'driver' ? tu('withDriver') : tu('selfOrDriver')],
    [t('delivery'), L.deliveryOptions.map((o) => t(`deliveryOptions.${o}` as 'deliveryOptions.branch_pickup')).join('، ')],
  ];
  const notice = (
    <p className="flex gap-2">
      <ShieldAlert aria-hidden className="size-5 shrink-0 text-stale" strokeWidth={1.75} />
      {t('safetyTitle')}
    </p>
  );
  return (
    <article className="flex flex-col gap-6 pb-40 lg:pb-0">
      <JsonLdScript data={listingJsonLd(d, l, url)} />
      <ListingViewTracker listingId={L.id} />
      <nav aria-label={tn('breadcrumb')} className="text-caption text-fg-secondary">
        <Link href={`/${d.card.city.slug}`} className="hover:underline">{d.card.city[l]}</Link>
        <span aria-hidden> / </span>
        <Link href={`/${d.card.city.slug}/${d.card.area.slug}`} className="hover:underline">{d.card.area[l]}</Link>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Gallery photos={photos} alt={`${name} ${L.year}`} />
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {d.card.featured ? <Badge kind="featured" /> : null}
              {L.freshness === 'fresh' ? <Badge kind="fresh">{tu('confirmedAgo', { ago: formatRelative(new Date(L.lastConfirmedAt), l) })}</Badge> : L.freshness === 'aging' ? <Badge kind="stale">{tu('confirmedAgo', { ago: formatRelative(new Date(L.lastConfirmedAt), l) })}</Badge> : null}
              {d.dealer.verified ? <Badge kind="verified" /> : null}
            </div>
            <h1 className="text-h1">
              {name} <span className="ag-tabular">{L.year}</span>
            </h1>
            <p className="text-caption text-fg-secondary">{t('lastConfirmed', { ago: formatRelative(new Date(L.lastConfirmedAt), l) })}</p>
            <div className="flex flex-wrap gap-2">
              <FavoriteButton card={d.card} variant="inline" />
              <ShareButton title={name} url={url} />
              <RequestAvailability listingId={L.id} />
            </div>
          </header>
          {!L.available ? <InlineAlert tone="warning">{t('unavailableNotice')}</InlineAlert> : null}
          <InlineAlert tone="warning" title={t('safetyTitle')}>
            {t('safetyBody')}
          </InlineAlert>
          <section aria-labelledby="req">
            <h2 id="req" className="mb-3 text-h2">{t('requirements')}</h2>
            <RequirementList deposit={L.prices.deposit} minAge={L.minAge} requiredDocs={L.requiredDocs} kmLimitPerDay={L.kmLimitPerDay} airportPickup={L.airportPickup} />
            <p className="mt-3 text-caption text-fg-secondary">{t('priceNote')}</p>
          </section>
          <section aria-labelledby="facts">
            <h2 id="facts" className="mb-3 text-h2">{t('facts')}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-caption text-fg-secondary">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {(l === 'ar' ? L.descriptionAr : L.descriptionEn) ?? L.descriptionAr ?? L.descriptionEn ? (
            <section aria-labelledby="desc">
              <h2 id="desc" className="mb-2 text-h2">{t('description')}</h2>
              <p className="whitespace-pre-line">{(l === 'ar' ? L.descriptionAr : L.descriptionEn) ?? L.descriptionAr ?? L.descriptionEn}</p>
            </section>
          ) : null}
          <section aria-labelledby="dealer" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <h2 id="dealer" className="text-h2">{t('dealer')}</h2>
            <Link href={`/dealers/${d.dealer.slug}`} className="text-body font-semibold text-brand hover:underline">
              {l === 'ar' ? d.dealer.nameAr : d.dealer.nameEn}
            </Link>
            <p className="text-caption text-fg-secondary">{`${d.card.area[l]}، ${d.card.city[l]}`}</p>
            {d.dealer.responseRate !== null ? <p className="text-caption">{t('responseRate', { percent: Math.round(d.dealer.responseRate * 100) })}</p> : null}
            {d.dealer.reviews.count ? <p className="text-caption">{`★ ${d.dealer.reviews.average} · ${tu('reviewsCount', { count: d.dealer.reviews.count })}`}</p> : null}
            <p className="text-caption text-fg-secondary">{t('memberSince', { date: formatDate(new Date(d.dealer.memberSince), l, { month: 'long', year: 'numeric' }) })}</p>
          </section>
          <ReportButton listingId={L.id} />
        </div>
        <ListingContactBar listingId={L.id} prices={L.prices} notice={notice} />
      </div>
      {d.similar.length ? (
        <section aria-labelledby="similar">
          <h2 id="similar" className="mb-4 text-h2">{t('similar')}</h2>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {d.similar.map((c) => (
              <li key={c.id}>
                <ContactableCard card={c} href={`/${locale}${listingPath(c)}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
