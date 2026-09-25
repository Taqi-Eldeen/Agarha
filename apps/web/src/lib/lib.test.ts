import { businessSchema, reportInputSchema, type Landing } from '@agarha/schemas';
import { listingCard, listingDetail } from '@agarha/test-utils';
import { describe, expect, it } from 'vitest';
import { issueKey, schemaResolver } from './forms';
import { landingIntro, landingMeta, landingTitle } from './landing';
import { listingPath, parseListingParam } from './listing-url';
import { alternates, dealerJsonLd, listingJsonLd } from './seo';

const known = (k: string) =>
  ['invalid_cr', 'invalid_egypt_mobile', 'required', 'too_short'].includes(k);

describe('listing URLs', () => {
  it('puts the id first so slugs can change without breaking links', () => {
    const card = listingCard({
      id: '3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f',
      slug: 'kia-cerato-2023',
    });
    expect(listingPath(card)).toBe('/cars/3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f-kia-cerato-2023');
    expect(parseListingParam('3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f-old-slug')).toBe(
      '3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f',
    );
  });
});

describe('SEO', () => {
  it('emits canonical + hreflang for both locales with Arabic as x-default', () => {
    expect(alternates('en', '/cairo')).toEqual({
      canonical: 'https://agarha.test/en/cairo',
      languages: {
        ar: 'https://agarha.test/ar/cairo',
        en: 'https://agarha.test/en/cairo',
        'x-default': 'https://agarha.test/ar/cairo',
      },
    });
    expect(alternates('ar', '/')?.canonical).toBe('https://agarha.test/ar');
  });

  it('describes a listing as Product + Offer in EGP per day, with availability', () => {
    const d = listingDetail(
      listingCard({
        available: false,
        prices: { day: 950, week: null, month: null, deposit: 3000 },
      }),
    );
    const ld = listingJsonLd(d, 'ar', 'https://agarha.test/ar/cars/x');
    expect(ld['@type']).toBe('Product');
    expect(ld.offers).toMatchObject({
      priceCurrency: 'EGP',
      price: 950,
      availability: 'https://schema.org/OutOfStock',
      priceSpecification: { unitCode: 'DAY' },
    });
    expect(ld.name).toContain('تويوتا');
    expect('aggregateRating' in ld).toBe(false);
  });

  it('describes a dealer as AutoRental with geo only when known', () => {
    const ld = dealerJsonLd({
      name: 'Test Rentals',
      url: 'https://agarha.test/en/dealers/test',
      phone: '+201000000001',
      branches: [
        { name: 'Main', lat: 30.06, lng: 31.33, address: 'Abbas El Akkad' },
        { name: 'Second', lat: null, lng: null, address: null },
      ],
      rating: { count: 4, average: 4.5 },
    });
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 4,
    });
    expect(ld.department[0]).toHaveProperty('geo');
    expect(ld.department[1]).not.toHaveProperty('geo');
  });
});

describe('landing pages', () => {
  const city = {
    id: '00000000-0000-4000-8000-00000000c001',
    slug: 'cairo',
    nameAr: 'القاهرة',
    nameEn: 'Cairo',
    isActive: true,
    lat: 30.04,
    lng: 31.24,
  };
  const base: Landing = {
    city,
    area: null,
    type: null,
    areas: [],
    types: [],
    stats: { n: 12, min: 900, max: 3000, median: 1400 },
    listings: [],
  } as unknown as Landing;
  it('titles city, area and type pages natively in each language', () => {
    expect(landingTitle('en', base)).toBe('Car rental in Cairo');
    expect(
      landingTitle('ar', {
        ...base,
        area: { ...city, cityId: city.id, slug: 'maadi', nameAr: 'المعادي', nameEn: 'Maadi' },
      } as Landing),
    ).toContain('المعادي');
    expect(landingTitle('en', { ...base, type: 'suv' })).toContain('SUV');
  });
  it('noindexes empty landing pages (no thin content in search results)', () => {
    expect(landingIntro('en', base)).toContain('12');
    expect(
      landingMeta(
        'en',
        { ...base, stats: { n: 0, min: null, max: null, median: null } } as Landing,
        '/cairo',
      ).robots,
    ).toEqual({ index: false });
    expect(landingMeta('en', base, '/cairo').robots).toBeUndefined();
  });
});

describe('form validation with shared schemas', () => {
  it('maps zod issues to catalog keys, preferring a schema-provided code', () => {
    expect(issueKey({ message: 'invalid_cr', code: 'invalid_format' }, known)).toBe('invalid_cr');
    expect(
      issueKey({ message: 'Too small', code: 'too_small', minimum: 1, input: '' }, known),
    ).toBe('required');
    expect(
      issueKey({ message: 'Too small', code: 'too_small', minimum: 2, input: 'a' }, known),
    ).toBe('too_short');
    expect(issueKey({ message: 'x', code: 'too_big', input: 'a'.repeat(99) }, known)).toBe(
      'too_long',
    );
  });

  it('validates the dealer business form exactly like the API', async () => {
    const resolver = schemaResolver(businessSchema, (v: Record<string, string>) => v, known);
    const bad = await resolver(
      {
        legalName: 'A',
        displayNameAr: 'اسم',
        displayNameEn: 'Name',
        commercialRegistrationNo: '!!',
        taxCardNo: '123',
        phone: '0123',
        whatsapp: '0101',
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(Object.keys(bad.errors).sort()).toEqual([
      'commercialRegistrationNo',
      'legalName',
      'phone',
      'taxCardNo',
      'whatsapp',
    ]);
    expect(bad.errors.commercialRegistrationNo?.message).toBe('invalid_cr');
    const ok = await resolver(
      {
        legalName: 'Nile Rentals LLC',
        displayNameAr: 'نايل',
        displayNameEn: 'Nile',
        commercialRegistrationNo: '123456',
        taxCardNo: '111-222-333',
        phone: '0223456789',
        whatsapp: '01012345678',
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(ok.errors).toEqual({});
  });

  it('requires a report reason', async () => {
    const resolver = schemaResolver(
      reportInputSchema,
      (v: { reason: string }) => ({
        listingId: '00000000-0000-4000-8000-000000000001',
        reason: v.reason || undefined,
      }),
      known,
    );
    const r = await resolver({ reason: '' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(r.errors.reason?.message).toBe('required');
  });
});
