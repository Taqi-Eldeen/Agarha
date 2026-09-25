import { formatDate } from '@agarha/i18n';
import { Badge, ReviewItem } from '@agarha/ui-web';
import { MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContactableCard } from '@/components/contact-actions';
import { listingPath } from '@/lib/listing-url';
import { alternates, dealerJsonLd, JsonLdScript, siteUrl } from '@/lib/seo';
import { serverApi } from '@/lib/server-api';

export const revalidate = 60;
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await serverApi.dealer(slug);
  if (!p) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: 'web.seo' });
  const l = locale as 'ar' | 'en';
  const city = p.branches[0]?.area ? (l === 'ar' ? p.branches[0].area.cityNameAr : p.branches[0].area.cityNameEn) : '';
  return { title: t('dealerTitle', { dealer: l === 'ar' ? p.dealer.nameAr : p.dealer.nameEn, city }), alternates: alternates(locale, `/dealers/${slug}`) };
}

export default async function DealerProfilePage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as 'ar' | 'en';
  const p = await serverApi.dealer(slug);
  if (!p) notFound();
  const t = await getTranslations('web.dealerPage');
  const tl = await getTranslations('web.listing');
  const name = l === 'ar' ? p.dealer.nameAr : p.dealer.nameEn;
  return (
    <div className="flex flex-col gap-8">
      <JsonLdScript data={dealerJsonLd({ name, url: `${siteUrl}/${locale}/dealers/${slug}`, phone: p.dealer.phone, branches: p.branches.map((b) => ({ name: l === 'ar' ? b.nameAr : b.nameEn, lat: b.lat, lng: b.lng, address: l === 'ar' ? b.addressAr : b.addressEn })), rating: p.reviews })} />
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h1">{name}</h1>
          <Badge kind="verified" />
        </div>
        {p.responseRate !== null ? <p>{tl('responseRate', { percent: Math.round(p.responseRate * 100) })}</p> : null}
        <p className="text-caption text-fg-secondary">{tl('memberSince', { date: formatDate(new Date(p.dealer.memberSince), l, { month: 'long', year: 'numeric' }) })}</p>
        {(l === 'ar' ? p.dealer.descriptionAr : p.dealer.descriptionEn) ? <p className="max-w-3xl">{l === 'ar' ? p.dealer.descriptionAr : p.dealer.descriptionEn}</p> : null}
      </header>
      <section aria-labelledby="branches">
        <h2 id="branches" className="mb-3 text-h2">{t('branches')}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {p.branches.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <p className="font-semibold">{l === 'ar' ? b.nameAr : b.nameEn}</p>
              <p className="flex items-center gap-1 text-caption text-fg-secondary">
                <MapPin aria-hidden className="size-4" strokeWidth={1.75} />
                {[l === 'ar' ? b.addressAr : b.addressEn, b.area ? (l === 'ar' ? b.area.nameAr : b.area.nameEn) : null].filter(Boolean).join('، ')}
              </p>
              {b.lat !== null && b.lng !== null ? (
                <a className="text-caption text-brand hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`} target="_blank" rel="noopener noreferrer">
                  {tl('branch')}
                </a>
              ) : null}
              {b.phone ? (
                <a href={`tel:${b.phone}`} dir="ltr" className="flex items-center gap-1 text-caption">
                  <Phone aria-hidden className="size-4" strokeWidth={1.75} />
                  {b.phone}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="fleet">
        <h2 id="fleet" className="mb-3 text-h2">{t('fleet', { count: p.fleetTotal })}</h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {p.fleet.map((c) => (
            <li key={c.id}>
              <ContactableCard card={c} href={`/${locale}${listingPath(c)}`} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="reviews">
        <h2 id="reviews" className="mb-3 text-h2">{t('reviews')}</h2>
        {p.reviews.latest.length ? p.reviews.latest.map((r) => <ReviewItem key={r.id} rating={r.rating} body={r.body} date={r.createdAt} reply={r.dealerReply} />) : <p className="text-fg-secondary">{t('noReviews')}</p>}
      </section>
    </div>
  );
}
