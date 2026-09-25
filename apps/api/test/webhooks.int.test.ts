import { createHmac, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { notificationDeliveries } from '../src/db/schema/notifications';
import { createTestApp, resetData, type TestApp } from './helpers';

const WA_SECRET = 'wa-app-secret-for-tests';
const TWILIO_TOKEN = 'twilio-token-for-tests';
const TWILIO_URL = 'https://api.example.test/v1/webhooks/sms/twilio';
const VONAGE_SECRET = 'vonage-signature-secret-for-tests-000000';

describe('delivery webhooks are signature-verified', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({
      WHATSAPP_APP_SECRET: WA_SECRET,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-me',
      TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
      TWILIO_STATUS_WEBHOOK_URL: TWILIO_URL,
      VONAGE_SIGNATURE_SECRET: VONAGE_SECRET,
    });
  });
  beforeEach(() => resetData(t));
  afterAll(() => t.close());

  const delivery = async (provider: string, providerMessageId: string) => {
    const [d] = await t.db
      .insert(notificationDeliveries)
      .values({
        recipient: '+201012345678',
        channel: provider === 'meta-whatsapp' ? 'whatsapp' : 'sms',
        template: 'otp',
        locale: 'ar',
        provider,
        providerMessageId,
        status: 'sent',
      })
      .returning();
    return d!.id;
  };
  const statusOf = async (id: string) =>
    (await t.db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id)))[0]!;

  it('WhatsApp: verification handshake, HMAC-SHA256 signature, status mapping', async () => {
    await t.http
      .get('/v1/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '42' })
      .expect(200)
      .expect((r) => expect(r.text).toBe('42'));
    await t.http
      .get('/v1/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '42' })
      .expect(403);

    const id = await delivery('meta-whatsapp', 'wamid.1');
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }],
    });
    await t.http
      .post('/v1/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', 'sha256=' + '0'.repeat(64))
      .send(body)
      .expect(401);
    expect((await statusOf(id)).status).toBe('sent');
    const sig = createHmac('sha256', WA_SECRET).update(body).digest('hex');
    await t.http
      .post('/v1/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', `sha256=${sig}`)
      .send(body)
      .expect(200);
    expect((await statusOf(id)).status).toBe('delivered');
  });

  it('Twilio: X-Twilio-Signature over URL + sorted params', async () => {
    const id = await delivery('twilio', 'SM123');
    const params = { MessageSid: 'SM123', MessageStatus: 'undelivered', ErrorCode: '30003' };
    const data =
      TWILIO_URL +
      Object.keys(params)
        .sort()
        .map((k) => k + params[k as keyof typeof params])
        .join('');
    const sig = createHmac('sha1', TWILIO_TOKEN).update(data).digest('base64');
    await t.http
      .post('/v1/webhooks/sms/twilio')
      .type('form')
      .set('x-twilio-signature', 'bad')
      .send(params)
      .expect(401);
    await t.http
      .post('/v1/webhooks/sms/twilio')
      .type('form')
      .set('x-twilio-signature', sig)
      .send(params)
      .expect(200);
    expect(await statusOf(id)).toMatchObject({ status: 'failed', lastError: '30003' });
  });

  it('Vonage: HS256 JWT with the body hash', async () => {
    const id = await delivery('vonage', 'vg-1');
    const body = JSON.stringify({ messageId: 'vg-1', status: 'delivered' });
    const jwt = (hash: string) =>
      new SignJWT({ payload_hash: hash })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .sign(new TextEncoder().encode(VONAGE_SECRET));
    await t.http
      .post('/v1/webhooks/sms/vonage')
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${await jwt('not-the-hash')}`)
      .send(body)
      .expect(401);
    await t.http
      .post('/v1/webhooks/sms/vonage')
      .set('content-type', 'application/json')
      .send(body)
      .expect(401);
    const hash = createHash('sha256').update(body).digest('hex');
    await t.http
      .post('/v1/webhooks/sms/vonage')
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${await jwt(hash)}`)
      .send(body)
      .expect(200);
    expect((await statusOf(id)).status).toBe('delivered');
  });
});
