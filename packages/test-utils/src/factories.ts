import type { LeadResponse, ListingCard, ListingDetail, SearchResult } from '@agarha/schemas';

// Deterministic, obviously synthetic data (Section 10: never real IDs, names or documents).
let seq = 0;
export const nextSeq = () => ++seq;
export const resetSeq = () => void (seq = 0);

/** Egyptian mobile in the 010 range reserved for tests (0100000xxxx). */
export function fakeMobile(n = nextSeq()): string {
  return `+2010000${String(n % 10000).padStart(4, '0')}`;
}

export function fakeMobileNational(n = nextSeq()): string {
  return fakeMobile(n).replace('+20', '0');
}

export function uuid(n = nextSeq()): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function listingCard(overrides: Partial<ListingCard> = {}): ListingCard {
  const n = nextSeq();
  return {
    id: uuid(n),
    slug: `toyota-corolla-2024-${n}`,
    photo: null,
    photoCount: 0,
    make: { ar: 'تويوتا', en: 'Toyota' },
    model: { ar: 'كورولا', en: 'Corolla' },
    bodyType: 'sedan',
    year: 2024,
    transmission: 'automatic',
    seats: 5,
    driverOption: 'self',
    prices: { day: 1200, week: 7700, month: null, deposit: 5000 },
    requiredDocs: ['national_id', 'egyptian_driving_licence'],
    minAge: 23,
    kmLimitPerDay: 250,
    airportPickup: false,
    lastConfirmedAt: new Date().toISOString(),
    available: true,
    featured: false,
    dealer: { id: uuid(1000 + n), slug: `test-rentals-${n}`, nameAr: `تأجير تجريبي ${n}`, nameEn: `Test Rentals ${n}`, verified: true, whatsapp: fakeMobile(n), phone: fakeMobile(n) },
    area: { slug: 'nasr-city', ar: 'مدينة نصر', en: 'Nasr City' },
    city: { slug: 'cairo', ar: 'القاهرة', en: 'Cairo' },
    location: { lat: 30.06, lng: 31.33 },
    ...overrides,
  };
}

export function searchResult(count = 3, overrides: Partial<SearchResult> = {}): SearchResult {
  const items = Array.from({ length: count }, () => ({ card: listingCard() }));
  return { items, nextCursor: null, total: count, ...overrides } as SearchResult;
}

export function listingDetail(card = listingCard()): ListingDetail {
  return {
    listing: {
      id: card.id,
      dealerId: card.dealer.id,
      branchId: uuid(),
      carModelId: uuid(),
      trimId: null,
      status: 'live',
      available: card.available,
      lastConfirmedAt: card.lastConfirmedAt,
      freshness: 'fresh',
      freshnessScore: 1,
      transmission: card.transmission,
      seats: card.seats,
      fuel: 'petrol',
      year: card.year,
      color: 'white',
      driverOption: card.driverOption,
      minAge: card.minAge,
      requiredDocs: card.requiredDocs,
      kmLimitPerDay: card.kmLimitPerDay,
      deliveryOptions: ['branch_pickup'],
      airportPickup: card.airportPickup,
      descriptionAr: null,
      descriptionEn: null,
      featured: card.featured,
      featuredUntil: null,
      hiddenReason: null,
      publishedAt: card.lastConfirmedAt,
      updatedAt: card.lastConfirmedAt,
      prices: card.prices,
      photos: [],
      model: null,
    },
    card,
    dealer: { id: card.dealer.id, slug: card.dealer.slug, nameAr: card.dealer.nameAr, nameEn: card.dealer.nameEn, verified: true, verifiedAt: card.lastConfirmedAt, memberSince: '2026-01-01T00:00:00Z', reviews: { count: 0, average: null }, responseRate: null },
    similar: [],
    safety: { neverPayDepositBeforeSeeing: true, agarhaIsNotAParty: true },
  } as unknown as ListingDetail;
}

export function leadResponse(card: ListingCard, channel: 'whatsapp' | 'call' = 'whatsapp'): LeadResponse {
  const refCode = 'AG-7K2Q';
  const url = channel === 'whatsapp' ? `https://wa.me/${card.dealer.whatsapp.replace('+', '')}?text=${encodeURIComponent(`Ref ${refCode}`)}` : `tel:${card.dealer.phone}`;
  return { leadId: uuid(), refCode, channel, url };
}
