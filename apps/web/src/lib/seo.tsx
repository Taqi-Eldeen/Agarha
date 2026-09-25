import type { ListingDetail } from '@agarha/schemas';
import type { Metadata } from 'next';
import { env } from './env';

export const siteUrl = env.NEXT_PUBLIC_SITE_URL;

/** Canonical + hreflang alternates for a path without the locale prefix, e.g. "/cairo". */
export function alternates(locale: string, path: string): Metadata['alternates'] {
  const clean = path === '/' ? '' : path;
  return {
    canonical: `${siteUrl}/${locale}${clean}`,
    languages: { ar: `${siteUrl}/ar${clean}`, en: `${siteUrl}/en${clean}`, 'x-default': `${siteUrl}/ar${clean}` },
  };
}

/** Product + Offer (vehicle rental) structured data for a listing page. */
export function listingJsonLd(d: ListingDetail, locale: 'ar' | 'en', url: string) {
  const name = `${d.card.make[locale]} ${d.card.model[locale]} ${d.card.year}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    category: 'Car rental',
    url,
    image: d.listing.photos.map((p) => p.urls?.webp?.['1280']).filter(Boolean),
    brand: { '@type': 'Brand', name: d.card.make.en },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EGP',
      price: d.card.prices.day,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: d.card.prices.day, priceCurrency: 'EGP', unitCode: 'DAY' },
      availability: d.card.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'AutoRental', name: locale === 'ar' ? d.dealer.nameAr : d.dealer.nameEn, url: `${siteUrl}/${locale}/dealers/${d.dealer.slug}` },
      areaServed: d.card.city.en,
    },
    ...(d.dealer.reviews.average !== null && d.dealer.reviews.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: d.dealer.reviews.average, reviewCount: d.dealer.reviews.count } } : {}),
  };
}

/** LocalBusiness (AutoRental) for dealer profile pages. */
export function dealerJsonLd(p: { name: string; url: string; phone: string; branches: { name: string; lat: number | null; lng: number | null; address: string | null }[]; rating: { count: number; average: number | null } }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: p.name,
    url: p.url,
    telephone: p.phone,
    ...(p.rating.average !== null && p.rating.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.average, reviewCount: p.rating.count } } : {}),
    department: p.branches.map((b) => ({
      '@type': 'AutoRental',
      name: b.name,
      ...(b.address ? { address: { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'EG' } } : {}),
      ...(b.lat !== null && b.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } } : {}),
    })),
  };
}

export function JsonLdScript({ data }: { data: object }) {
  // JSON-LD is data, not markup; "<" is escaped so it can't close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
