import sharp from 'sharp';
import { currentTotp } from '../src/modules/identity';
import { Queues } from '../src/infra/queue/queues';
import { ListingsService } from '../src/modules/listings';
import { VerificationService } from '../src/modules/verification';
import { adminSession, bearer, dealerOwner, type TestApp } from './helpers';

export async function jpeg(w = 1200, h = 800): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: 'Phone' } } })
    .toBuffer();
}

export async function catalogIds(t: TestApp) {
  const cities = await t.http.get('/v1/catalog/cities').expect(200);
  const cairo = await t.http.get('/v1/catalog/cities/cairo').expect(200);
  const nasr = cairo.body.areas.find((a: { slug: string }) => a.slug === 'nasr-city');
  const makes = await t.http.get('/v1/catalog/makes').expect(200);
  const toyota = makes.body.items.find((m: { slug: string }) => m.slug === 'toyota');
  const models = await t.http.get(`/v1/catalog/makes/${toyota.id}/models`).expect(200);
  const corolla = models.body.items.find((m: { slug: string }) => m.slug === 'corolla');
  return { cities: cities.body.items, areaId: nasr.id as string, modelId: corolla.id as string };
}

/** Uploads via the presigned URL exactly like a browser would (PUT with the signed content-type). */
export function upload(t: TestApp, url: string, body: Buffer, type: string) {
  const path = url.replace('http://127.0.0.1', '');
  return t.http.put(path).set('content-type', type).send(body);
}

/** Runs the media queue job inline (the worker does this in production). */
export async function drainMedia(t: TestApp) {
  const q = t.app.get(Queues, { strict: false }).get('media');
  const jobs = await q.getJobs(['waiting', 'delayed', 'prioritized']);
  for (const j of jobs) {
    const d = j.data as { kind: string; photoId?: string; docId?: string };
    if (d.kind === 'listing_photo')
      await t.app.get(ListingsService, { strict: false }).processPhoto(d.photoId!);
    else await t.app.get(VerificationService, { strict: false }).process(d.docId!);
    await j.remove();
  }
}

export const LISTING = {
  year: 2024,
  color: 'white',
  transmission: 'automatic',
  fuel: 'petrol',
  seats: 5,
  driverOption: 'self',
  priceDayEgp: 1500,
  priceWeekEgp: 9000,
  depositEgp: 5000,
  minAge: 23,
  requiredDocs: ['national_id', 'egyptian_driving_licence'],
  kmLimitPerDay: 200,
};

/** A verified dealer with one branch, ready to publish cars. Returns tokens for owner and admin. */
export async function verifiedDealer(t: TestApp, phone: string) {
  const ids = await catalogIds(t);
  const owner = await dealerOwner(t, phone);
  const biz = await t.http
    .post('/v1/dealer/onboarding/business')
    .set(bearer(owner.token))
    .send({
      legalName: 'Nile Rentals LLC',
      displayNameAr: 'النيل لتأجير السيارات',
      displayNameEn: 'Nile Rentals',
      commercialRegistrationNo: '123456',
      taxCardNo: '123-456-789',
      phone: '0223456789',
      whatsapp: phone,
      client: 'mobile',
    })
    .expect(201);
  const token = biz.body.tokens.accessToken as string;
  await t.http
    .post('/v1/dealer/branches')
    .set(bearer(token))
    .send({
      areaId: ids.areaId,
      nameAr: 'فرع مدينة نصر',
      nameEn: 'Nasr City branch',
      addressEn: 'Abbas El Akkad St',
    })
    .expect(201);
  const pdf = Buffer.from('%PDF-1.4\n% test document\n');
  for (const type of ['commercial_registration', 'tax_card', 'owner_national_id']) {
    const up = await t.http
      .post('/v1/dealer/documents/uploads')
      .set(bearer(token))
      .send({ type, mimeType: 'application/pdf', sizeBytes: pdf.length, sha256: 'a'.repeat(64) })
      .expect(201);
    await upload(t, up.body.upload.url, pdf, 'application/pdf').expect(200);
    await t.http
      .post(`/v1/dealer/documents/${up.body.documentId}/complete`)
      .set(bearer(token))
      .expect(200);
  }
  await drainMedia(t);
  await t.http.post('/v1/dealer/onboarding/submit').set(bearer(token)).expect(200);
  const admin = await adminSession(t, `ops-${phone}@agarha.com`);
  const docs = await t.http
    .get(`/v1/admin/dealers/${biz.body.dealer.id}/documents`)
    .set(bearer(admin.token))
    .expect(200);
  for (const d of docs.body.items)
    await t.http
      .post(`/v1/admin/documents/${d.id}/review`)
      .set(bearer(admin.token))
      .send({ approve: true })
      .expect(200);
  await t.http
    .post(`/v1/admin/dealers/${biz.body.dealer.id}/verify`)
    .set(bearer(admin.token))
    .expect(200);
  return {
    ...ids,
    token,
    dealerId: biz.body.dealer.id as string,
    admin,
    totpSecret: owner.totpSecret,
    currentTotp,
  };
}

/** Creates a car with one processed photo and publishes it; approves it if pre-moderated. */
export async function liveListing(
  t: TestApp,
  d: Awaited<ReturnType<typeof verifiedDealer>>,
  overrides: Record<string, unknown> = {},
) {
  const branches = await t.http.get('/v1/dealer/branches').set(bearer(d.token)).expect(200);
  const car = await t.http
    .post('/v1/dealer/listings')
    .set(bearer(d.token))
    .send({ ...LISTING, carModelId: d.modelId, branchId: branches.body.items[0].id, ...overrides });
  if (car.status !== 201)
    throw new Error(`create listing ${car.status}: ${JSON.stringify(car.body)}`);
  const img = await jpeg();
  const ph = await t.http
    .post(`/v1/dealer/listings/${car.body.id}/photos`)
    .set(bearer(d.token))
    .send({ mimeType: 'image/jpeg', sizeBytes: img.length })
    .expect(201);
  await upload(t, ph.body.upload.url, img, 'image/jpeg').expect(200);
  await t.http
    .post(`/v1/dealer/listings/${car.body.id}/photos/${ph.body.photoId}/complete`)
    .set(bearer(d.token))
    .expect(200);
  await drainMedia(t);
  const pub = await t.http
    .post(`/v1/dealer/listings/${car.body.id}/publish`)
    .set(bearer(d.token))
    .expect(200);
  if (pub.body.status === 'pending')
    await t.http
      .post(`/v1/admin/listings/${car.body.id}/moderate`)
      .set(bearer(d.admin.token))
      .send({ decision: 'approve' })
      .expect(200);
  return car.body.id as string;
}
