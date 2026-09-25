import { ERROR_CODES } from '@agarha/schemas';
import { Outbox } from '../src/modules/notifications';
import {
  ORIGIN,
  bearer,
  createTestApp,
  customerSession,
  freshIp,
  lastCode,
  resetData,
  type TestApp,
} from './helpers';

describe('identity: customer phone OTP', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetData(t));
  afterAll(() => t.close());

  it('rejects a missing or failed Turnstile before sending anything', async () => {
    const r = await t.http
      .post('/v1/auth/otp/request')
      .send({ phone: '01012345678', turnstileToken: 'fail' })
      .expect(400);
    expect(r.body).toMatchObject({ code: ERROR_CODES.captchaFailed });
    expect(r.body.requestId).toBeTruthy();
    expect(Outbox.entries).toHaveLength(0);
  });

  it('accepts 01X, +20 and 0020 inputs and stores E.164', async () => {
    const ip = freshIp();
    for (const phone of ['01012345678', '+201012345679', '00201012345670']) {
      const r = await t.http
        .post('/v1/auth/otp/request')
        .set('x-forwarded-for', ip)
        .send({ phone, turnstileToken: 'pass' })
        .expect(200);
      expect(r.body.channel).toBe('sms');
    }
    expect(Outbox.entries.map((e) => e.to)).toEqual([
      '+201012345678',
      '+201012345679',
      '+201012345670',
    ]);
  });

  it('signs in end to end, sets cookies on web and no-store on private responses', async () => {
    const ip = freshIp();
    const req = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01011112222', turnstileToken: 'pass', locale: 'en' })
      .expect(200);
    expect(Outbox.latestTo('+201011112222')!.body).toMatch(/^Your Agarha code is \d{6}/);
    const res = await t.http
      .post('/v1/auth/otp/verify')
      .set('x-forwarded-for', ip)
      .send({
        challengeId: req.body.challengeId,
        phone: '01011112222',
        code: lastCode('+201011112222'),
      })
      .expect(200);
    expect(res.body.user.phone).toBe('+201011112222');
    expect(res.body.tokens).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const at = cookies.find((c) => c.startsWith('ag_c_at='))!;
    expect(at).toMatch(/HttpOnly/);
    expect(at).toMatch(/SameSite=Lax/);
    expect(cookies.find((c) => c.startsWith('ag_c_rt='))).toMatch(/Path=\/v1\/auth/);
    const me = await t.http.get('/v1/me').set('cookie', at.split(';')[0]!).expect(200);
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.body.phone).toBe('+201011112222');
  });

  it('limits sends to 3 per number per 15 minutes', async () => {
    for (let i = 0; i < 3; i++)
      await t.http
        .post('/v1/auth/otp/request')
        .set('x-forwarded-for', freshIp())
        .send({ phone: '01033334444', turnstileToken: 'pass' })
        .expect(200);
    const r = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', freshIp())
      .send({ phone: '01033334444', turnstileToken: 'pass' })
      .expect(429);
    expect(r.body.code).toBe(ERROR_CODES.rateLimited);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits sends per IP', async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++)
      await t.http
        .post('/v1/auth/otp/request')
        .set('x-forwarded-for', ip)
        .send({ phone: `0101000${String(i).padStart(4, '0')}`, turnstileToken: 'pass' })
        .expect(200);
    await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01019999999', turnstileToken: 'pass' })
      .expect(429);
  });

  it('locks a challenge after 5 wrong codes', async () => {
    const ip = freshIp();
    const req = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01055556666', turnstileToken: 'pass' })
      .expect(200);
    const good = lastCode('+201055556666');
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      const r = await t.http
        .post('/v1/auth/otp/verify')
        .set('x-forwarded-for', ip)
        .send({ challengeId: req.body.challengeId, phone: '01055556666', code: bad })
        .expect(400);
      expect(r.body.code).toBe(ERROR_CODES.otpInvalid);
    }
    await t.http
      .post('/v1/auth/otp/verify')
      .set('x-forwarded-for', ip)
      .send({ challengeId: req.body.challengeId, phone: '01055556666', code: bad })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe(ERROR_CODES.otpTooManyAttempts));
    // Even the right code is refused now.
    await t.http
      .post('/v1/auth/otp/verify')
      .set('x-forwarded-for', ip)
      .send({ challengeId: req.body.challengeId, phone: '01055556666', code: good })
      .expect(400);
  });

  it('fails over to the next SMS provider, then to WhatsApp', async () => {
    const t2 = await createTestApp({ SMS_PROVIDERS: 'console,console' });
    try {
      Outbox.failNext.set('console', 2);
      const r = await t2.http
        .post('/v1/auth/otp/request')
        .set('x-forwarded-for', freshIp())
        .send({ phone: '01077778888', turnstileToken: 'pass' })
        .expect(200);
      expect(r.body.channel).toBe('whatsapp');
      expect(Outbox.latestTo('+201077778888')!.channel).toBe('whatsapp');
    } finally {
      await t2.close();
    }
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const s = await customerSession(t, '01022223333');
    const r1 = await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refresh }).expect(200);
    const next = r1.body.tokens.refreshToken as string;
    expect(next).not.toBe(s.refresh);
    // Replaying the old token = theft: 401 and the new token is dead too.
    const reuse = await t.http
      .post('/v1/auth/refresh')
      .send({ refreshToken: s.refresh })
      .expect(401);
    expect(reuse.body.code).toBe(ERROR_CODES.refreshReused);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: next }).expect(401);
  });

  it('blocks cookie-authenticated writes from other origins (CSRF)', async () => {
    const ip = freshIp();
    const req = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01044445555', turnstileToken: 'pass' });
    const res = await t.http
      .post('/v1/auth/otp/verify')
      .set('x-forwarded-for', ip)
      .send({
        challengeId: req.body.challengeId,
        phone: '01044445555',
        code: lastCode('+201044445555'),
      });
    const cookie = (res.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('ag_c_at='))!
      .split(';')[0]!;
    await t.http
      .patch('/v1/me')
      .set('cookie', cookie)
      .set('origin', 'https://evil.example')
      .send({ displayName: 'x' })
      .expect(403);
    await t.http
      .patch('/v1/me')
      .set('cookie', cookie)
      .set('origin', ORIGIN)
      .send({ displayName: 'Mona' })
      .expect(200);
  });

  it('exports and deletes an account (PDPL)', async () => {
    const s = await customerSession(t, '01066667777');
    const exp = await t.http.get('/v1/me/export').set(bearer(s.token)).expect(200);
    expect(exp.body.account.phone).toBe('+201066667777');
    expect(exp.body).toHaveProperty('favorites');
    await t.http.delete('/v1/me').set(bearer(s.token)).expect(204);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refresh }).expect(401);
    // The number can sign up again as a fresh account.
    const again = await customerSession(t, '01066667777');
    expect(again.userId).not.toBe(s.userId);
  });

  it('links Google sign-in to a phone on first use', async () => {
    const first = await t.http
      .post('/v1/auth/social')
      .send({ provider: 'google', idToken: 'google:sub-123:mona@example.com' })
      .expect(202);
    expect(first.body.status).toBe('phone_required');
    const ip = freshIp();
    const req = await t.http
      .post('/v1/auth/otp/request')
      .set('x-forwarded-for', ip)
      .send({ phone: '01088889999', turnstileToken: 'pass' });
    await t.http
      .post('/v1/auth/social/link')
      .set('x-forwarded-for', ip)
      .send({
        linkToken: first.body.linkToken,
        challengeId: req.body.challengeId,
        phone: '01088889999',
        code: lastCode('+201088889999'),
        client: 'mobile',
      })
      .expect(200);
    const second = await t.http
      .post('/v1/auth/social')
      .send({ provider: 'google', idToken: 'google:sub-123:mona@example.com' })
      .expect(200);
    expect(second.body.status).toBe('signed_in');
    expect(second.body.tokens.accessToken).toBeTruthy();
  });
});
