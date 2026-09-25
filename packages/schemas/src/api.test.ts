import { describe, expect, it } from 'vitest';
import {
  citySchema,
  leadResponseSchema,
  listingCardSchema,
  mapPinsSchema,
  searchResultSchema,
} from './api.js';

// Response contracts: the shapes web and mobile rely on. The API serialises through these schemas.
const card = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'toyota-corolla-2024',
  photo: {
    url320: 'https://media.agarha.test/320.webp',
    url640: 'https://media.agarha.test/640.webp',
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  },
  photoCount: 4,
  make: { ar: 'تويوتا', en: 'Toyota' },
  model: { ar: 'كورولا', en: 'Corolla' },
  bodyType: 'sedan',
  year: 2024,
  transmission: 'automatic',
  seats: 5,
  driverOption: 'both',
  prices: { day: 1200, week: 7700, month: null, deposit: 5000 },
  requiredDocs: ['national_id', 'egyptian_driving_licence'],
  minAge: 23,
  kmLimitPerDay: 250,
  airportPickup: true,
  lastConfirmedAt: '2026-09-20T08:00:00.000Z',
  available: true,
  featured: false,
  dealer: {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'nile',
    nameAr: 'نايل',
    nameEn: 'Nile',
    verified: true,
    whatsapp: '+201000000001',
    phone: '+201000000001',
  },
  area: { slug: 'maadi', ar: 'المعادي', en: 'Maadi' },
  city: { slug: 'cairo', ar: 'القاهرة', en: 'Cairo' },
  location: { lat: 29.96, lng: 31.25 },
};

describe('response contracts', () => {
  it('a listing card carries every "fact before contact"', () => {
    const c = listingCardSchema.parse(card);
    expect(c.prices.deposit).toBe(5000);
    expect(listingCardSchema.safeParse({ ...card, prices: { day: 1200 } }).success).toBe(false);
    expect(listingCardSchema.safeParse({ ...card, driverOption: 'chauffeur' }).success).toBe(false);
  });
  it('search results are cursor-paginated', () => {
    const r = searchResultSchema.parse({
      items: [{ card, distanceKm: 2.4 }],
      nextCursor: 'abc',
      total: 1,
    });
    expect(r.nextCursor).toBe('abc');
  });
  it('map pins are minimal (id, position, price, featured)', () => {
    expect(
      mapPinsSchema.parse({
        items: [{ id: card.id, lat: 30, lng: 31, price: 900, featured: true }],
      }).items,
    ).toHaveLength(1);
  });
  it('a lead returns the reference code and the deep link for the channel', () => {
    const lead = leadResponseSchema.parse({
      leadId: card.id,
      refCode: 'AG-7K2Q',
      channel: 'whatsapp',
      url: 'https://wa.me/201000000001?text=Ref%20AG-7K2Q',
    });
    expect(lead.url).toContain('AG-7K2Q');
    expect(leadResponseSchema.safeParse({ ...lead, channel: 'sms' }).success).toBe(false);
  });
  it('cities carry both names', () => {
    expect(
      citySchema.parse({
        id: card.id,
        slug: 'cairo',
        nameAr: 'القاهرة',
        nameEn: 'Cairo',
        isActive: true,
        lat: null,
        lng: null,
      }).nameAr,
    ).toBe('القاهرة');
  });
});
