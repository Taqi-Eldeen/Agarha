import { cairoDate } from '../dates';
import { bboxOf } from '../geo';
import { initialLocale } from '../i18n';
import { listingShareUrl, webPathToAppPath } from '../links';
import { paramsFrom } from '../search-params';
import { tokenStore } from '../tokens';

jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));

describe('deep links (universal / app links → app routes)', () => {
  const id = '3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f';
  it.each([
    [`https://agarha.com/ar/cars/${id}-toyota-corolla-2024`, `/cars/${id}`],
    [`/en/cars/${id.toUpperCase()}-x`, `/cars/${id}`],
    ['https://agarha.com/ar/dealers/nile-rentals', '/dealers/nile-rentals'],
    ['https://agarha.com/en/search?city=cairo&type=suv', '/search?city=cairo&type=suv'],
    ['https://agarha.com/ar/cairo', '/search?city=cairo'],
    ['https://agarha.com/ar/cairo/maadi', '/search?city=cairo&area=maadi'],
    ['https://agarha.com/ar', '/'],
    ['https://agarha.com/ar/saved', '/saved'],
  ])('%s → %s', (input, expected) => {
    expect(webPathToAppPath(input)).toBe(expected);
  });
  it.each([
    'https://agarha.com/ar/help',
    'https://agarha.com/ar/dealer/fleet',
    '/ar/cars/not-a-uuid',
    '/ar/legal/terms',
  ])('%s has no app screen', (input) => {
    expect(webPathToAppPath(input)).toBeNull();
  });
  it('builds share URLs on the public website', () => {
    expect(listingShareUrl('en', id, 'toyota-corolla-2024')).toBe(
      `https://agarha.com/en/cars/${id}-toyota-corolla-2024`,
    );
  });
});

describe('search params from a link', () => {
  it('keeps known filters and drops junk', () => {
    expect(
      paramsFrom({
        city: 'cairo',
        period: 'week',
        priceMax: '1500',
        transmission: 'automatic',
        sort: 'price_asc',
        airport: 'true',
        bogus: 'x',
        seatsMin: 'abc',
      }),
    ).toEqual({
      city: 'cairo',
      period: 'week',
      priceMax: 1500,
      transmission: 'automatic',
      sort: 'price_asc',
      airport: true,
    });
  });
  it('ignores unknown enum values', () => {
    expect(paramsFrom({ period: 'year', transmission: 'cvt', sort: 'random' })).toEqual({});
  });
});

describe('map bbox', () => {
  it('is west,south,east,north around the region centre', () => {
    expect(bboxOf({ latitude: 30, longitude: 31, latitudeDelta: 0.2, longitudeDelta: 0.4 })).toBe(
      '30.8000,29.9000,31.2000,30.1000',
    );
  });
});

describe('locale', () => {
  it('defaults to Arabic unless the phone is in English, and remembers the choice', () => {
    expect(initialLocale(null, 'ar')).toBe('ar');
    expect(initialLocale(null, 'fr')).toBe('ar');
    expect(initialLocale(null, 'en')).toBe('en');
    expect(initialLocale('ar', 'en')).toBe('ar');
  });
});

describe('token store (SecureStore)', () => {
  it('persists, notifies and clears', async () => {
    const seen: boolean[] = [];
    const off = tokenStore.subscribe((v) => seen.push(v));
    await tokenStore.set({ accessToken: 'a'.repeat(30), refreshToken: 'r'.repeat(40) });
    expect(await tokenStore.get()).toEqual({
      accessToken: 'a'.repeat(30),
      refreshToken: 'r'.repeat(40),
    });
    await tokenStore.set(null);
    expect(await tokenStore.get()).toBeNull();
    off();
    expect(seen).toEqual([true, false]);
  });
});

describe('availability request dates', () => {
  it('uses the Cairo calendar day, not UTC', () => {
    // 23:30 UTC on 14 Sep is already 15 Sep in Cairo (UTC+3 in summer).
    expect(cairoDate(0, new Date('2026-09-14T23:30:00Z'))).toBe('2026-09-15');
    expect(cairoDate(1, new Date('2026-09-14T10:00:00Z'))).toBe('2026-09-15');
  });
});
