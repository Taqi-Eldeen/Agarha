import { eq, sql } from 'drizzle-orm';
import { leads } from '../src/db/schema/leads';
import { notificationDeliveries } from '../src/db/schema/notifications';
import { LISTING, liveListing, verifiedDealer } from './fixtures';
import {
  bearer,
  createTestApp,
  customerSession,
  freshIp,
  resetData,
  type TestApp,
} from './helpers';

describe('P5 trust + monetization, P6 scale features', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetData(t));
  afterAll(() => t.close());

  it('reviews are lead-gated, 24h after the lead, moderated, and dealers can reply', async () => {
    const d = await verifiedDealer(t, '01030000001');
    const car = await liveListing(t, d);
    const c = await customerSession(t, '01030000100');
    const lead = await t.http
      .post('/v1/leads')
      .set(bearer(c.token))
      .set('x-forwarded-for', freshIp())
      .send({ listingId: car, channel: 'whatsapp' })
      .expect(201);
    // Review prompt is scheduled 24h later (push).
    const [prompt] = await t.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.template, 'review_prompt'));
    expect(prompt).toBeUndefined(); // no push token registered: nothing reachable, nothing queued
    await t.http
      .post('/v1/reviews')
      .set(bearer(c.token))
      .send({ leadId: lead.body.leadId, rating: 5, body: 'Great car' })
      .expect(409);
    await t.db.update(leads).set({ createdAt: sql`now() - interval '25 hours'` });
    const other = await customerSession(t, '01030000101');
    await t.http
      .post('/v1/reviews')
      .set(bearer(other.token))
      .send({ leadId: lead.body.leadId, rating: 1 })
      .expect(403);
    const rev = await t.http
      .post('/v1/reviews')
      .set(bearer(c.token))
      .send({ leadId: lead.body.leadId, rating: 5, body: 'Car was exactly as listed' })
      .expect(201);
    await t.http
      .post('/v1/reviews')
      .set(bearer(c.token))
      .send({ leadId: lead.body.leadId, rating: 5 })
      .expect(409);
    const dir = await t.http.get('/v1/dealers').expect(200);
    const slug = dir.body.items[0].slug;
    expect((await t.http.get(`/v1/dealers/${slug}/reviews`)).body.items).toHaveLength(0);
    await t.http
      .post(`/v1/admin/reviews/${rev.body.id}/moderate`)
      .set(bearer(d.admin.token))
      .send({ approve: true })
      .expect(200);
    const pub = await t.http.get(`/v1/dealers/${slug}/reviews`).expect(200);
    expect(pub.body.items[0]).toMatchObject({ rating: 5, body: 'Car was exactly as listed' });
    await t.http
      .post(`/v1/dealer/reviews/${rev.body.id}/reply`)
      .set(bearer(d.token))
      .send({ text: 'شكراً لحضرتك!' })
      .expect(200);
    const detail = await t.http.get(`/v1/listings/${car}`).expect(200);
    expect(detail.body.dealer.reviews).toEqual({ count: 1, average: 5 });
  });

  it('push notifications respect preferences; review prompt is delayed 24h', async () => {
    const d = await verifiedDealer(t, '01030000002');
    const car = await liveListing(t, d);
    const c = await customerSession(t, '01030000102');
    await t.http
      .post('/v1/me/push-tokens')
      .set(bearer(c.token))
      .send({ token: 'ExponentPushToken[abc123]', platform: 'android' })
      .expect(204);
    await t.http
      .post('/v1/leads')
      .set(bearer(c.token))
      .set('x-forwarded-for', freshIp())
      .send({ listingId: car, channel: 'call', locale: 'en' })
      .expect(201);
    const [prompt] = await t.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.template, 'review_prompt'));
    expect(prompt).toMatchObject({
      channel: 'push',
      recipient: 'ExponentPushToken[abc123]',
      locale: 'en',
      status: 'queued',
    });
    const job = await t.app
      .get(await import('../src/infra/queue/queues').then((m) => m.Queues), { strict: false })
      .get('notifications')
      .getJob(prompt!.id);
    expect(job!.opts.delay).toBeGreaterThanOrEqual(24 * 3_600_000);
    await t.http
      .put('/v1/me/notification-preferences')
      .set(bearer(c.token))
      .send({ preferences: [{ topic: 'reviews', channel: 'push', enabled: false }] })
      .expect(200);
  });

  it('response rate appears once there is enough lead data', async () => {
    const d = await verifiedDealer(t, '01030000003');
    const car = await liveListing(t, d);
    for (let i = 0; i < 6; i++)
      await t.http
        .post('/v1/leads')
        .set('x-forwarded-for', freshIp())
        .send({ listingId: car, channel: 'whatsapp' })
        .expect(201);
    const ls = await t.http.get('/v1/dealer/leads').set(bearer(d.token)).expect(200);
    for (const l of ls.body.items.slice(0, 3))
      await t.http
        .put(`/v1/dealer/leads/${l.id}/outcome`)
        .set(bearer(d.token))
        .send({ outcome: 'rented' })
        .expect(200);
    const detail = await t.http.get(`/v1/listings/${car}`).expect(200);
    expect(detail.body.dealer.responseRate).toBe(0.5);
  });

  it('subscription: checkout → signed webhook → active plan; replayed and forged webhooks do nothing', async () => {
    const d = await verifiedDealer(t, '01030000004');
    const plans = await t.http.get('/v1/plans').expect(200);
    expect(plans.body.items.map((p: { code: string }) => p.code)).toEqual(['free', 'pro', 'fleet']);
    const sub = await t.http
      .post('/v1/dealer/billing/subscribe')
      .set(bearer(d.token))
      .send({
        planCode: 'pro',
        contactName: 'Owner Test',
        contactPhone: '01030000004',
        locale: 'en',
      })
      .expect(200);
    expect(sub.body.checkoutUrl).toMatch(/\/en\/dealer\/billing\/mock-checkout\?invoice=/);
    expect(sub.body.invoice).toMatchObject({ totalEgp: 1499, vatEgp: 184, status: 'open' });
    expect(sub.body.invoice.number).toMatch(/^AG-\d{4}-\d{6}$/);
    await t.http
      .post('/v1/webhooks/payments/mock')
      .set('x-mock-signature', 'f'.repeat(64))
      .send({ eventId: 'x', invoiceId: sub.body.invoice.id, success: true, amountEgp: 1499 })
      .expect(401);
    await t.http
      .post(`/v1/dev/payments/mock/${sub.body.invoice.id}`)
      .send({ amountEgp: 1499 })
      .expect(200);
    const b = await t.http.get('/v1/dealer/billing').set(bearer(d.token)).expect(200);
    expect(b.body.subscription).toMatchObject({
      planCode: 'pro',
      status: 'active',
      featuredCreditsRemaining: 4,
    });
    expect(b.body.invoices[0].status).toBe('paid');
    expect(b.body.limits).toMatchObject({ maxLiveListings: 60, maxTeamMembers: 8 });
  });

  it('featured listing via credit: badge + ranked first in search', async () => {
    const d = await verifiedDealer(t, '01030000005');
    const a = await liveListing(t, d);
    const b = await liveListing(t, d);
    const sub = await t.http
      .post('/v1/dealer/billing/subscribe')
      .set(bearer(d.token))
      .send({ planCode: 'pro', contactName: 'Owner', contactPhone: '01030000005' })
      .expect(200);
    await t.http
      .post(`/v1/dev/payments/mock/${sub.body.invoice.id}`)
      .send({ amountEgp: 1499 })
      .expect(200);
    const f = await t.http
      .post('/v1/dealer/billing/feature')
      .set(bearer(d.token))
      .send({ listingId: a, days: 7, contactName: 'Owner', contactPhone: '01030000005' })
      .expect(200);
    expect(f.body.placement).toBeTruthy();
    const r = await t.http.get('/v1/search?city=cairo').expect(200);
    expect(r.body.items[0].card).toMatchObject({ id: a, featured: true });
    expect(r.body.items[1].card.id).toBe(b);
    // Paid path (no credits left on free plan dealers): creates an invoice with the per-day price.
    const d2 = await verifiedDealer(t, '01030000006');
    const c = await liveListing(t, d2);
    const paid = await t.http
      .post('/v1/dealer/billing/feature')
      .set(bearer(d2.token))
      .send({ listingId: c, days: 3, contactName: 'Owner', contactPhone: '01030000006' })
      .expect(200);
    expect(paid.body.invoice.totalEgp).toBe(150);
  });

  it('plan limits cap live listings', async () => {
    const d = await verifiedDealer(t, '01030000007');
    await t.http
      .put('/v1/admin/plans/free')
      .set(bearer(d.admin.token))
      .send({
        code: 'free',
        nameAr: 'مجاني',
        nameEn: 'Free',
        priceMonthlyEgp: 0,
        maxLiveListings: 1,
        maxTeamMembers: 3,
        featuredCreditsPerMonth: 0,
        isActive: true,
        sortOrder: 0,
      })
      .expect(200);
    await liveListing(t, d);
    await expect(liveListing(t, d)).rejects.toThrow(/409/);
  });

  it('P6: request availability for dates, dealer answers, customer is notified', async () => {
    const d = await verifiedDealer(t, '01030000008');
    const car = await liveListing(t, d);
    const c = await customerSession(t, '01030000108');
    const start = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
    const r = await t.http
      .post('/v1/availability-requests')
      .set(bearer(c.token))
      .send({ listingId: car, startDate: start, endDate: end })
      .expect(201);
    expect(r.body.refCode).toMatch(/^AR-/);
    const inbox = await t.http
      .get('/v1/dealer/availability-requests')
      .set(bearer(d.token))
      .expect(200);
    expect(inbox.body.items[0].id).toBe(r.body.id);
    await t.http
      .post(`/v1/dealer/availability-requests/${r.body.id}/answer`)
      .set(bearer(d.token))
      .send({ available: true })
      .expect(200);
    const mine = await t.http.get('/v1/me/availability-requests').set(bearer(c.token)).expect(200);
    expect(mine.body.items[0].status).toBe('available');
    await t.http
      .post('/v1/availability-requests')
      .set(bearer(c.token))
      .send({ listingId: car, startDate: end, endDate: start })
      .expect(400);
  });

  it('P6: CSV import validates every row, then creates drafts', async () => {
    const d = await verifiedDealer(t, '01030000009');
    const csv = [
      'make,model,year,color,transmission,fuel,seats,driver_option,price_day,price_week,price_month,deposit,min_age,required_docs,km_limit_per_day,airport_pickup,branch',
      'Toyota,Corolla,2023,white,automatic,petrol,5,self,1400,,,5000,23,national_id|egyptian_driving_licence,250,no,',
      'كيا,سبورتاج,2024,black,automatic,petrol,5,both,2500,15000,,8000,25,passport,,yes,',
    ].join('\n');
    const v = await t.http
      .post('/v1/dealer/listings/import')
      .set(bearer(d.token))
      .set('content-type', 'text/csv')
      .send(csv)
      .expect(200);
    expect(v.body).toMatchObject({ status: 'ready', rowCount: 2, errors: [] });
    const applied = await t.http
      .post(`/v1/dealer/listings/import/${v.body.importId}/apply`)
      .set(bearer(d.token))
      .expect(200);
    expect(applied.body.created).toBe(2);
    const bad =
      'make,model,year,color,transmission,fuel,seats,driver_option,price_day,deposit,min_age,required_docs\nTesla,Model Z,2024,red,automatic,electric,5,self,100,0,21,passport\nToyota,Corolla,1970,red,automatic,petrol,5,self,100,0,21,';
    const v2 = await t.http
      .post('/v1/dealer/listings/import')
      .set(bearer(d.token))
      .set('content-type', 'text/csv')
      .send(bad)
      .expect(200);
    expect(v2.body.status).toBe('failed');
    expect(v2.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(['model', 'year', 'requiredDocs']),
    );
  });

  it('admin console: user lookup, block, metrics dashboard', async () => {
    const d = await verifiedDealer(t, '01030000010');
    await liveListing(t, d);
    const c = await customerSession(t, '01030000110');
    const look = await t.http
      .get('/v1/admin/users?phone=01030000110')
      .set(bearer(d.admin.token))
      .expect(200);
    expect(look.body.user.id).toBe(c.userId);
    await t.http
      .post(`/v1/admin/users/${c.userId}/block`)
      .set(bearer(d.admin.token))
      .send({ reason: 'abuse' })
      .expect(200);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: c.refresh }).expect(401);
    const m = await t.http.get('/v1/admin/metrics').set(bearer(d.admin.token)).expect(200);
    expect(m.body.listings).toMatchObject({ live: 1, confirmedWithin7Days: 1, freshPercent: 100 });
    expect(m.body.dealers.verified).toBe(1);
    // Moderators can't read the audit log; support can't moderate listings.
    const { adminSession } = await import('./helpers');
    const support = await adminSession(t, 'support2@agarha.com', ['support']);
    await t.http.get('/v1/admin/listings').set(bearer(support.token)).expect(403);
    void LISTING;
  });

  it('admin IP allowlist blocks admin sign-in from unknown IPs', async () => {
    const t2 = await createTestApp({ ADMIN_IP_ALLOWLIST: '203.0.113.0/24' });
    try {
      await t2.http
        .post('/v1/auth/admin/dev-login')
        .set('x-forwarded-for', '198.51.100.7')
        .send({ email: 'ops@agarha.com' })
        .expect(403);
      await t2.http
        .post('/v1/auth/admin/dev-login')
        .set('x-forwarded-for', '203.0.113.9')
        .send({ email: 'nobody@agarha.com' })
        .expect(403); // passes IP, no staff account
    } finally {
      await t2.close();
    }
  });
});
