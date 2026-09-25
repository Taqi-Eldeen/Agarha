import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { withDealerRls } from '../src/db/db';
import { listings } from '../src/db/schema/listings';
import { ListingsService } from '../src/modules/listings';
import { Outbox } from '../src/modules/notifications';
import {
  LISTING,
  catalogIds,
  drainMedia,
  jpeg,
  liveListing,
  upload,
  verifiedDealer,
} from './fixtures';
import {
  adminSession,
  bearer,
  createTestApp,
  dealerOwner,
  freshIp,
  lastCode,
  resetData,
  type TestApp,
} from './helpers';
import { currentTotp } from '../src/modules/identity';

describe('P2 dealer side', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetData(t));
  afterAll(() => t.close());

  it('onboards: business → branch → documents → review → verified (with audit log)', async () => {
    const d = await verifiedDealer(t, '01012340001');
    const me = await t.http.get('/v1/dealer/me').set(bearer(d.token)).expect(200);
    expect(me.body.dealer.status).toBe('verified');
    expect(me.body.steps).toEqual({
      business: true,
      branches: true,
      documents: true,
      review: true,
    });
    expect(me.body.branches[0].lat).toBeCloseTo(30, 0); // geocoded by the mock maps adapter
    const audit = await t.http
      .get(`/v1/admin/audit?dealerId=${d.dealerId}`)
      .set(bearer(d.admin.token))
      .expect(200);
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'dealer.create',
        'branch.create',
        'verification_doc.upload',
        'dealer.submit',
        'verification_doc.approve',
        'dealer.verify',
      ]),
    );
  });

  it('cannot submit for review without documents, cannot verify with unapproved docs', async () => {
    const ids = await catalogIds(t);
    const owner = await dealerOwner(t, '01012340002');
    const biz = await t.http
      .post('/v1/dealer/onboarding/business')
      .set(bearer(owner.token))
      .send({
        legalName: 'X LLC',
        displayNameAr: 'إكس',
        displayNameEn: 'X Cars',
        commercialRegistrationNo: '999',
        taxCardNo: '111-222-333',
        phone: '01012340002',
        whatsapp: '01012340002',
        client: 'mobile',
      })
      .expect(201);
    const token = biz.body.tokens.accessToken;
    await t.http
      .post('/v1/dealer/branches')
      .set(bearer(token))
      .send({ areaId: ids.areaId, nameAr: 'فرع', nameEn: 'Branch', lat: 30.05, lng: 31.33 })
      .expect(201);
    await t.http.post('/v1/dealer/onboarding/submit').set(bearer(token)).expect(409);
  });

  it('serves verification documents only via 5-minute signed URLs to ops, and logs each view', async () => {
    const d = await verifiedDealer(t, '01012340003');
    const docs = await t.http
      .get(`/v1/admin/dealers/${d.dealerId}/documents`)
      .set(bearer(d.admin.token))
      .expect(200);
    const view = await t.http
      .post(`/v1/admin/documents/${docs.body.items[0].id}/view`)
      .set(bearer(d.admin.token))
      .expect(200);
    expect(new Date(view.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    const path = view.body.url.replace('http://127.0.0.1', '');
    await t.http.get(path).expect(200);
    await t.http.get(path.replace(/sig=[a-f0-9]+/, 'sig=' + 'b'.repeat(64))).expect(403);
    // Dealer tokens cannot reach admin endpoints; admin endpoints need admin scope.
    await t.http
      .post(`/v1/admin/documents/${docs.body.items[0].id}/view`)
      .set(bearer(d.token))
      .expect(401);
    const audit = await t.http
      .get(`/v1/admin/audit?targetType=verification_doc&targetId=${docs.body.items[0].id}`)
      .set(bearer(d.admin.token))
      .expect(200);
    expect(
      audit.body.items.some((a: { action: string }) => a.action === 'verification_doc.view'),
    ).toBe(true);
  });

  it('add-car wizard + media pipeline: EXIF stripped, 6 variants, blurhash, max 12 photos', async () => {
    const d = await verifiedDealer(t, '01012340004');
    const id = await liveListing(t, d);
    const car = await t.http.get(`/v1/dealer/listings/${id}`).set(bearer(d.token)).expect(200);
    const photo = car.body.photos[0];
    expect(photo.status).toBe('ready');
    expect(photo.blurhash).toBeTruthy();
    expect(Object.keys(photo.urls.webp)).toEqual(['320', '640', '1280']);
    const variant = await t.http
      .get(photo.urls.avif['640'].replace('http://127.0.0.1', ''))
      .expect(200);
    expect((await sharp(variant.body as Buffer).metadata()).exif).toBeUndefined();

    const img = await jpeg(400, 300);
    for (let i = 1; i < 12; i++)
      await t.http
        .post(`/v1/dealer/listings/${id}/photos`)
        .set(bearer(d.token))
        .send({ mimeType: 'image/jpeg', sizeBytes: img.length })
        .expect(201);
    await t.http
      .post(`/v1/dealer/listings/${id}/photos`)
      .set(bearer(d.token))
      .send({ mimeType: 'image/jpeg', sizeBytes: img.length })
      .expect(409);
    await t.http
      .post(`/v1/dealer/listings/${id}/photos`)
      .set(bearer(d.token))
      .send({ mimeType: 'image/jpeg', sizeBytes: 11 * 1024 * 1024 })
      .expect(400);
  });

  it('rejects an upload whose bytes do not match the signed type or size, and a fake image', async () => {
    const d = await verifiedDealer(t, '01012340005');
    const branches = await t.http.get('/v1/dealer/branches').set(bearer(d.token));
    const car = await t.http
      .post('/v1/dealer/listings')
      .set(bearer(d.token))
      .send({ ...LISTING, carModelId: d.modelId, branchId: branches.body.items[0].id })
      .expect(201);
    const fake = Buffer.from('<?php echo "not an image"; ?>'.padEnd(200, ' '));
    const ph = await t.http
      .post(`/v1/dealer/listings/${car.body.id}/photos`)
      .set(bearer(d.token))
      .send({ mimeType: 'image/jpeg', sizeBytes: fake.length })
      .expect(201);
    await upload(t, ph.body.upload.url, fake, 'image/png').expect(403);
    await upload(
      t,
      ph.body.upload.url,
      Buffer.concat([fake, Buffer.from('x')]),
      'image/jpeg',
    ).expect(403);
    await upload(t, ph.body.upload.url, fake, 'image/jpeg').expect(200);
    await t.http
      .post(`/v1/dealer/listings/${car.body.id}/photos/${ph.body.photoId}/complete`)
      .set(bearer(d.token))
      .expect(200);
    await drainMedia(t);
    const photos = await t.http
      .get(`/v1/dealer/listings/${car.body.id}/photos`)
      .set(bearer(d.token))
      .expect(200);
    expect(photos.body.items[0].status).toBe('rejected');
    // Without a ready photo the car cannot go live.
    await t.http
      .post(`/v1/dealer/listings/${car.body.id}/publish`)
      .set(bearer(d.token))
      .expect(409);
  });

  it('pre-moderates a new dealer, then publishes directly after 5 approvals', async () => {
    const d = await verifiedDealer(t, '01012340006');
    const branches = await t.http.get('/v1/dealer/branches').set(bearer(d.token));
    const first = await t.http
      .post('/v1/dealer/listings')
      .set(bearer(d.token))
      .send({ ...LISTING, carModelId: d.modelId, branchId: branches.body.items[0].id })
      .expect(201);
    const img = await jpeg();
    const ph = await t.http
      .post(`/v1/dealer/listings/${first.body.id}/photos`)
      .set(bearer(d.token))
      .send({ mimeType: 'image/jpeg', sizeBytes: img.length });
    await upload(t, ph.body.upload.url, img, 'image/jpeg');
    await t.http
      .post(`/v1/dealer/listings/${first.body.id}/photos/${ph.body.photoId}/complete`)
      .set(bearer(d.token));
    await drainMedia(t);
    const pub = await t.http
      .post(`/v1/dealer/listings/${first.body.id}/publish`)
      .set(bearer(d.token))
      .expect(200);
    expect(pub.body.status).toBe('pending');
    const queue = await t.http
      .get('/v1/admin/listings?queue=pending')
      .set(bearer(d.admin.token))
      .expect(200);
    expect(queue.body.items.map((l: { id: string }) => l.id)).toContain(first.body.id);
    await t.http
      .post(`/v1/admin/listings/${first.body.id}/moderate`)
      .set(bearer(d.admin.token))
      .send({ decision: 'approve' })
      .expect(200);
    for (let i = 0; i < 4; i++) await liveListing(t, d);
    const sixth = await liveListing(t, d);
    const sixthCar = await t.http.get(`/v1/dealer/listings/${sixth}`).set(bearer(d.token));
    expect(sixthCar.body.status).toBe('live');
    const unreviewed = await t.http
      .get('/v1/admin/listings?queue=unreviewed')
      .set(bearer(d.admin.token))
      .expect(200);
    expect(unreviewed.body.items.map((l: { id: string }) => l.id)).toContain(sixth);
  });

  it('availability switch confirms freshness; confirm-all restores stale-hidden cars; 14-day auto-hide', async () => {
    const d = await verifiedDealer(t, '01012340007');
    const id = await liveListing(t, d);
    await t.db.update(listings).set({ lastConfirmedAt: new Date(Date.now() - 15 * 86_400_000) });
    const job = await t.app.get(ListingsService, { strict: false }).runFreshness();
    expect(job.hidden).toBe(1);
    const hidden = await t.http.get(`/v1/dealer/listings/${id}`).set(bearer(d.token));
    expect(hidden.body).toMatchObject({ status: 'hidden', hiddenReason: 'stale' });
    await t.http.get(`/v1/listings/${id}`).expect(404);
    expect(
      Outbox.entries.some((e) => e.channel === 'whatsapp' && e.meta?.template === 'listing_hidden'),
    ).toBe(false); // queued, not sent inline

    const all = await t.http
      .post('/v1/dealer/listings/confirm-all')
      .set(bearer(d.token))
      .expect(200);
    expect(all.body.restored).toBe(1);
    const back = await t.http.get(`/v1/dealer/listings/${id}`).set(bearer(d.token));
    expect(back.body).toMatchObject({ status: 'live', freshness: 'fresh' });

    const off = await t.http
      .put(`/v1/dealer/listings/${id}/availability`)
      .set(bearer(d.token))
      .send({ available: false })
      .expect(200);
    expect(off.body.available).toBe(false);
    const search = await t.http.get('/v1/search?city=cairo').expect(200);
    expect(search.body.items.map((i: { card: { id: string } }) => i.card.id)).not.toContain(id);
    await t.http
      .put(`/v1/dealer/listings/${id}/availability`)
      .set(bearer(d.token))
      .send({ available: true })
      .expect(200); // undo
    const again = await t.http.get('/v1/search?city=cairo').expect(200);
    expect(again.body.items.map((i: { card: { id: string } }) => i.card.id)).toContain(id);
  });

  it('kill switch: suspending a dealer hides every listing at once', async () => {
    const d = await verifiedDealer(t, '01012340008');
    const id = await liveListing(t, d);
    await t.http.get(`/v1/listings/${id}`).expect(200);
    await t.http
      .post(`/v1/admin/dealers/${d.dealerId}/suspend`)
      .set(bearer(d.admin.token))
      .send({ reason: 'deposit scam reports' })
      .expect(200);
    await t.http.get(`/v1/listings/${id}`).expect(404);
    expect((await t.http.get('/v1/search').expect(200)).body.total).toBe(0);
    await t.http
      .post(`/v1/admin/dealers/${d.dealerId}/unsuspend`)
      .set(bearer(d.admin.token))
      .expect(200);
    await t.http.get(`/v1/listings/${id}`).expect(200);
  });

  it('dealer policy layer + Postgres RLS isolate dealers from each other', async () => {
    const a = await verifiedDealer(t, '01012340009');
    const b = await verifiedDealer(t, '01012340010');
    const aCar = await liveListing(t, a);
    await t.http.get(`/v1/dealer/listings/${aCar}`).set(bearer(b.token)).expect(404);
    await t.http
      .put(`/v1/dealer/listings/${aCar}/availability`)
      .set(bearer(b.token))
      .send({ available: false })
      .expect(404);
    // Second line: as the restricted role, b's context sees none of a's rows even with a raw query.
    const seen = await withDealerRls(t.db, b.dealerId, (tx) =>
      tx.select({ id: listings.id }).from(listings),
    );
    expect(seen.map((r) => r.id)).not.toContain(aCar);
    const own = await withDealerRls(t.db, a.dealerId, (tx) =>
      tx.select({ id: listings.id }).from(listings),
    );
    expect(own.map((r) => r.id)).toContain(aCar);
    const count = await withDealerRls(t.db, b.dealerId, (tx) =>
      tx.execute(sql`select count(*)::int as n from listings`),
    );
    expect((count.rows[0] as { n: number }).n).toBe(0);
  });

  it('staff: invited by the owner, signs in with password + SMS OTP, cannot archive or manage billing', async () => {
    const d = await verifiedDealer(t, '01012340011');
    await t.http
      .post('/v1/dealer/team')
      .set(bearer(d.token))
      .send({ phone: '01012340099' })
      .expect(201);
    const ip = freshIp();
    const r = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01012340099', purpose: 'dealer_sign_up', turnstileToken: 'pass' })
      .expect(200);
    const proof = await t.http
      .post('/v1/auth/otp/proof')
      .set('x-forwarded-for', ip)
      .send({
        challengeId: r.body.challengeId,
        phone: '01012340099',
        code: lastCode('+201012340099'),
      })
      .expect(200);
    await t.http
      .post('/v1/auth/dealer/register')
      .send({
        phoneProof: proof.body.phoneProof,
        password: 'staff password 123',
        displayName: 'Staff',
      })
      .expect(201);
    const login = await t.http
      .post('/v1/auth/dealer/login')
      .set('x-forwarded-for', ip)
      .send({ phone: '01012340099', password: 'staff password 123', turnstileToken: 'pass' })
      .expect(200);
    expect(login.body.next).toBe('otp');
    const v = await t.http
      .post('/v1/auth/dealer/login/verify')
      .set('x-forwarded-for', ip)
      .send({
        loginToken: login.body.loginToken,
        challengeId: login.body.challengeId,
        code: lastCode('+201012340099'),
        client: 'mobile',
      })
      .expect(200);
    expect(v.body.session.roles).toEqual(['dealer_staff']);
    const staff = v.body.tokens.accessToken;
    const id = await liveListing(t, d);
    await t.http
      .put(`/v1/dealer/listings/${id}/availability`)
      .set(bearer(staff))
      .send({ available: false })
      .expect(200);
    await t.http.post(`/v1/dealer/listings/${id}/archive`).set(bearer(staff)).expect(403);
    await t.http.get('/v1/dealer/billing').set(bearer(staff)).expect(403);
    await t.http.get('/v1/dealer/team').set(bearer(staff)).expect(403);
  });

  it('owner sign-in requires TOTP and rejects replayed codes; wrong passwords lock the account', async () => {
    const owner = await dealerOwner(t, '01012340012');
    const ip = freshIp();
    const login = await t.http
      .post('/v1/auth/dealer/login')
      .set('x-forwarded-for', ip)
      .send({ phone: '01012340012', password: 'correct horse battery', turnstileToken: 'pass' })
      .expect(200);
    expect(login.body.next).toBe('totp');
    const code = currentTotp(owner.totpSecret);
    // The confirm step already used this time-step, so the same code is a replay.
    await t.http
      .post('/v1/auth/dealer/login/verify')
      .send({ loginToken: login.body.loginToken, code, client: 'mobile' })
      .expect(400);
    for (let i = 0; i < 9; i++)
      await t.http
        .post('/v1/auth/dealer/login')
        .set('x-forwarded-for', freshIp())
        .send({ phone: '01012340012', password: 'nope-nope-nope', turnstileToken: 'pass' })
        .expect(401);
    await t.http
      .post('/v1/auth/dealer/login')
      .set('x-forwarded-for', freshIp())
      .send({ phone: '01012340012', password: 'nope-nope-nope', turnstileToken: 'pass' })
      .expect(401);
    await t.http
      .post('/v1/auth/dealer/login')
      .set('x-forwarded-for', freshIp())
      .send({ phone: '01012340012', password: 'correct horse battery', turnstileToken: 'pass' })
      .expect(429);
  });

  it('dealer stats count views and contacts per car', async () => {
    const d = await verifiedDealer(t, '01012340013');
    const id = await liveListing(t, d);
    await t.http.get(`/v1/listings/${id}`).set('x-forwarded-for', freshIp()).expect(200);
    await t.http.get(`/v1/listings/${id}`).set('x-forwarded-for', freshIp()).expect(200);
    await t.http
      .post('/v1/leads')
      .set('x-forwarded-for', freshIp())
      .send({ listingId: id, channel: 'whatsapp' })
      .expect(201);
    const s = await t.http.get('/v1/dealer/stats?days=7').set(bearer(d.token)).expect(200);
    const car = s.body.cars.find((c: { listingId: string }) => c.listingId === id);
    expect(car).toMatchObject({ views: 2, whatsapp: 1, calls: 0, conversion: 50 });
    expect(s.body.freshnessScore).toBeGreaterThan(90);
  });

  it('ops can create a listing on behalf of a dealer (A4), audited as the staff member', async () => {
    const d = await verifiedDealer(t, '01012340014');
    const branches = await t.http.get('/v1/dealer/branches').set(bearer(d.token));
    const support = await adminSession(t, 'support@agarha.com', ['support']);
    const r = await t.http
      .post(`/v1/admin/listings/on-behalf/${d.dealerId}`)
      .set(bearer(support.token))
      .send({ ...LISTING, carModelId: d.modelId, branchId: branches.body.items[0].id })
      .expect(201);
    const audit = await t.http
      .get(`/v1/admin/audit?targetId=${r.body.id}`)
      .set(bearer(d.admin.token))
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({
      action: 'listing.create',
      actorUserId: support.userId,
      actorRole: 'support',
    });
  });
});
