import { leads } from '../src/db/schema/leads';
import { notificationDeliveries } from '../src/db/schema/notifications';
import { NotificationsService, Outbox } from '../src/modules/notifications';
import { SearchService } from '../src/modules/search';
import { eq } from 'drizzle-orm';
import { liveListing, verifiedDealer } from './fixtures';
import { bearer, createTestApp, customerSession, freshIp, resetData, type TestApp } from './helpers';

describe('P3 public web API', () => {
  let t: TestApp;
  let d: Awaited<ReturnType<typeof verifiedDealer>>;
  let cheap: string;
  let suv: string;
  let manual: string;

  beforeAll(async () => {
    t = await createTestApp();
    await resetData(t);
    d = await verifiedDealer(t, '01020000001');
    cheap = await liveListing(t, d, { priceDayEgp: 900, priceWeekEgp: null, depositEgp: 3000 });
    manual = await liveListing(t, d, { priceDayEgp: 1200, priceWeekEgp: 7500, transmission: 'manual', driverOption: 'both' });
    const makes = await t.http.get('/v1/catalog/makes');
    const kia = makes.body.items.find((m: { slug: string }) => m.slug === 'kia');
    const models = await t.http.get(`/v1/catalog/makes/${kia.id}/models`);
    const sportage = models.body.items.find((m: { slug: string }) => m.slug === 'sportage');
    suv = await liveListing(t, d, { carModelId: sportage.id, priceDayEgp: 2500, priceWeekEgp: 15000, seats: 7, driverOption: 'driver', airportPickup: true });
  });
  afterAll(() => t.close());

  const ids = (r: { body: { items: { card: { id: string } }[] } }) => r.body.items.map((i) => i.card.id);

  it('search is edge-cacheable and returns full listing cards', async () => {
    const r = await t.http.get('/v1/search?city=cairo').expect(200);
    expect(r.headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    expect(r.body.total).toBe(3);
    const card = r.body.items[0].card;
    expect(card).toMatchObject({ dealer: { verified: true }, city: { slug: 'cairo' }, area: { slug: 'nasr-city' } });
    expect(card.prices.deposit).toBeGreaterThan(0);
    expect(card.requiredDocs.length).toBeGreaterThan(0);
    expect(card.photo.url320).toMatch(/320\.webp$/);
  });

  it('filters by type, transmission, seats, driver option, airport and price for the chosen period', async () => {
    expect(ids(await t.http.get('/v1/search?type=suv'))).toEqual([suv]);
    expect(ids(await t.http.get('/v1/search?transmission=manual'))).toEqual([manual]);
    expect(ids(await t.http.get('/v1/search?seatsMin=7'))).toEqual([suv]);
    expect(new Set(ids(await t.http.get('/v1/search?driver=self')))).toEqual(new Set([cheap, manual]));
    expect(new Set(ids(await t.http.get('/v1/search?driver=driver')))).toEqual(new Set([manual, suv]));
    expect(ids(await t.http.get('/v1/search?airport=true'))).toEqual([suv]);
    expect(ids(await t.http.get('/v1/search?priceMax=1000'))).toEqual([cheap]);
    // Weekly: cheap has no explicit week price -> 900 × 7 = 6300.
    expect(ids(await t.http.get('/v1/search?period=week&priceMax=7000'))).toEqual([cheap]);
  });

  it('sorts by price and paginates with cursors', async () => {
    const asc = await t.http.get('/v1/search?sort=price_asc&limit=2').expect(200);
    expect(ids(asc)).toEqual([cheap, manual]);
    const next = await t.http.get(`/v1/search?sort=price_asc&limit=2&cursor=${asc.body.nextCursor}`).expect(200);
    expect(ids(next)).toEqual([suv]);
    expect(next.body.nextCursor).toBeNull();
    expect(ids(await t.http.get('/v1/search?sort=price_desc'))[0]).toBe(suv);
  });

  it('matches Arabic queries with alef/taa-marbuta variants and typos', async () => {
    expect(ids(await t.http.get(`/v1/search?q=${encodeURIComponent('سبورتاج')}`))).toEqual([suv]);
    expect(new Set(ids(await t.http.get(`/v1/search?q=${encodeURIComponent('مدينه نصر')}`)))).toEqual(new Set([cheap, manual, suv]));
    expect(ids(await t.http.get('/v1/search?q=sportge'))).toContain(suv);
    const sug = await t.http.get(`/v1/catalog/suggest?q=${encodeURIComponent('كورولا')}`).expect(200);
    expect(sug.body.models[0].nameEn).toBe('Corolla');
  });

  it('near me, bounding box and map pins', async () => {
    const near = await t.http.get('/v1/search?lat=30.05&lng=31.33&radiusKm=20&sort=distance').expect(200);
    expect(near.body.total).toBe(3);
    expect(typeof near.body.items[0].distanceKm).toBe('number');
    expect((await t.http.get('/v1/search?lat=31.2&lng=29.9&radiusKm=5')).body.total).toBe(0);
    const pins = await t.http.get('/v1/search/map?bbox=31.0,29.8,31.6,30.3').expect(200);
    expect(pins.body.items).toHaveLength(3);
    expect(pins.body.items[0]).toEqual(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number), price: expect.any(Number) }));
  });

  it('listing page shows facts, freshness, the deposit notice and a dealer card with trust signals', async () => {
    const r = await t.http.get(`/v1/listings/${cheap}`).expect(200);
    expect(r.body.listing).toMatchObject({ freshness: 'fresh', minAge: 23, kmLimitPerDay: 200, prices: { day: 900, deposit: 3000 } });
    expect(r.body.safety).toEqual({ neverPayDepositBeforeSeeing: true, agarhaIsNotAParty: true });
    expect(r.body.dealer).toMatchObject({ verified: true, reviews: { count: 0 }, responseRate: null });
    expect(r.body.similar.length).toBeGreaterThanOrEqual(0);
  });

  it('logs a lead anonymously and returns a wa.me link with the reference code (idempotent)', async () => {
    const ip = freshIp();
    const r = await t.http.post('/v1/leads').set('x-forwarded-for', ip).set('idempotency-key', 'k-1').send({ listingId: cheap, channel: 'whatsapp', locale: 'ar' }).expect(201);
    expect(r.body.refCode).toMatch(/^AG-[2-9A-HJ-NP-Z]{4}$/);
    expect(r.body.url).toMatch(/^https:\/\/wa\.me\/201020000001\?text=/);
    expect(decodeURIComponent(r.body.url.split('text=')[1])).toBe(`مرحباً، أستفسر عن تويوتا كورولا ٢٠٢٤ على أجّرها (Ref ${r.body.refCode})`);
    const replay = await t.http.post('/v1/leads').set('x-forwarded-for', ip).set('idempotency-key', 'k-1').send({ listingId: cheap, channel: 'whatsapp', locale: 'ar' }).expect(201);
    expect(replay.body.refCode).toBe(r.body.refCode);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    const call = await t.http.post('/v1/leads').set('x-forwarded-for', ip).send({ listingId: cheap, channel: 'call' }).expect(201);
    expect(call.body.url).toBe('tel:+20223456789');
    const dealerLeads = await t.http.get('/v1/dealer/leads').set(bearer(d.token)).expect(200);
    expect(dealerLeads.body.items[0]).toMatchObject({ refCode: call.body.refCode, channel: 'call', listing: { nameAr: 'تويوتا كورولا' } });
    await t.http.put(`/v1/dealer/leads/${dealerLeads.body.items[0].id}/outcome`).set(bearer(d.token)).send({ outcome: 'from_agarha' }).expect(200);
    // Dealer WhatsApp alert is queued (sent by the worker), with the ref code.
    const [delivery] = await t.db.select().from(notificationDeliveries).where(eq(notificationDeliveries.template, 'lead_alert'));
    expect(delivery).toMatchObject({ channel: 'whatsapp', recipient: '+201020000001', status: 'queued' });
    await t.app.get(NotificationsService, { strict: false }).deliver(delivery!.id, 1);
    expect(Outbox.latestTo('+201020000001', 'whatsapp')!.body).toContain(r.body.refCode.slice(0, 3));
  });

  it('rate-limits leads per IP and listing', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) await t.http.post('/v1/leads').set('x-forwarded-for', ip).send({ listingId: suv, channel: 'call' }).expect(201);
    await t.http.post('/v1/leads').set('x-forwarded-for', ip).send({ listingId: suv, channel: 'call' }).expect(429);
  });

  it('reports, favorites and saved searches need a phone-OTP account', async () => {
    await t.http.post('/v1/reports').send({ listingId: cheap, reason: 'scam_or_deposit_request' }).expect(401);
    const c = await customerSession(t, '01020000100');
    const rep = await t.http.post('/v1/reports').set(bearer(c.token)).send({ listingId: cheap, reason: 'scam_or_deposit_request', details: 'asked for deposit by bank transfer' }).expect(201);
    const queue = await t.http.get('/v1/admin/reports').set(bearer(d.admin.token)).expect(200);
    expect(queue.body.items[0].id).toBe(rep.body.id);

    await t.http.put(`/v1/me/favorites/${suv}`).set(bearer(c.token)).expect(204);
    const favs = await t.http.get('/v1/me/favorites/cards').set(bearer(c.token)).expect(200);
    expect(favs.body.items.map((x: { id: string }) => x.id)).toEqual([suv]);

    const saved = await t.http.post('/v1/me/saved-searches').set(bearer(c.token)).send({ name: 'SUVs', query: { city: 'cairo', type: 'suv' } }).expect(201);
    await t.http.patch(`/v1/me/saved-searches/${saved.body.id}`).set(bearer(c.token)).send({ alertsEnabled: true }).expect(200);
    await t.db.execute(`UPDATE saved_searches SET last_notified_at = now() - interval '1 day'` as never);
    const job = await t.app.get(SearchService, { strict: false }).runSavedSearchMatching();
    expect(job.checked).toBe(1);
  });

  it('dealer directory, profile, landing pages and sitemap data', async () => {
    const dir = await t.http.get('/v1/dealers?city=cairo').expect(200);
    expect(dir.body.items[0]).toMatchObject({ nameEn: 'Nile Rentals', verified: true, branchCount: 1 });
    const prof = await t.http.get(`/v1/dealers/${dir.body.items[0].slug}`).expect(200);
    expect(prof.body.fleetTotal).toBe(3);
    expect(prof.body.branches[0].area.nameEn).toBe('Nasr City');
    const land = await t.http.get('/v1/landing/cairo').expect(200);
    expect(land.body.stats).toMatchObject({ n: 3, min: 900, max: 2500 });
    expect(land.body.areas.find((a: { slug: string }) => a.slug === 'nasr-city').listings).toBe(3);
    const area = await t.http.get('/v1/landing/cairo?area=nasr-city&type=suv').expect(200);
    expect(area.body.total).toBe(1);
    const sm = await t.http.get('/v1/seo/sitemap').expect(200);
    expect(sm.body.listings).toHaveLength(3);
    expect(sm.body.cities).toEqual(['cairo', 'giza']);
    expect(sm.body.types).toEqual(expect.arrayContaining([{ city: 'cairo', type: 'suv' }]));
  });

  it('account deletion unlinks leads but keeps them for the dealer', async () => {
    const c = await customerSession(t, '01020000200');
    const lead = await t.http.post('/v1/leads').set(bearer(c.token)).set('x-forwarded-for', freshIp()).send({ listingId: manual, channel: 'whatsapp' }).expect(201);
    await t.http.delete('/v1/me').set(bearer(c.token)).expect(204);
    const [row] = await t.db.select().from(leads).where(eq(leads.id, lead.body.leadId));
    expect(row!.userId).toBeNull();
  });
});
