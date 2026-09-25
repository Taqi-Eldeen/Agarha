import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { seedCatalog } from '../scripts/seed-catalog';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadEnv, type Env } from '../src/config/env';
import { DB, type Database } from '../src/db/db';
import { REDIS } from '../src/infra/redis/redis';
import { FakeTurnstile, ID_TOKEN_VERIFIER, TURNSTILE, UsersService, currentTotp, type IdTokenVerifier } from '../src/modules/identity';
import { Outbox } from '../src/modules/notifications';

export const ORIGIN = 'http://localhost:3000';

/** Deterministic fake: idToken "google:<sub>:<email>:<hd>" */
export class FakeIdTokens implements IdTokenVerifier {
  async verify(_p: string, token: string) {
    const [, subject, email, hd] = token.split(':');
    return { subject: subject!, email: email!, emailVerified: true, ...(hd ? { hostedDomain: hd } : {}) };
  }
}

const TOTP_KEY = randomBytes(32).toString('base64');

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    APP_ENV: 'local',
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    REDIS_URL: process.env.TEST_REDIS_URL!,
    JWT_SECRET: 'test-jwt-secret-000000000000000000000000',
    HASH_PEPPER: 'test-pepper-0000000000000000000000000000',
    TOTP_ENCRYPTION_KEY: TOTP_KEY,
    TURNSTILE_SECRET_KEY: 'unused-in-tests',
    COOKIE_SECURE: 'false',
    TRUST_PROXY_HOPS: '1',
    CORS_ORIGINS: ORIGIN,
    SMS_PROVIDERS: 'console',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: `/tmp/agarha-test-storage-${process.pid}`,
    API_PUBLIC_URL: 'http://127.0.0.1',
    ADMIN_DEV_LOGIN: 'true',
    GOOGLE_WORKSPACE_DOMAIN: 'agarha.com',
    FLAGS: '*',
    LOG_LEVEL: 'fatal',
    ...overrides,
  });
}

export interface TestApp {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  db: Database;
  redis: Redis;
  env: Env;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const env = testEnv(overrides);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(TURNSTILE)
    .useClass(FakeTurnstile)
    .overrideProvider(ID_TOKEN_VERIFIER)
    .useClass(FakeIdTokens)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
  configureApp(app, env);
  await app.init();
  const db = app.get<Database>(DB);
  const redis = app.get<Redis>(REDIS);
  return { app, http: request(app.getHttpServer()), db, redis, env, close: () => app.close() };
}

/** Wipes every table (keeps migrations), re-seeds the catalog and clears Redis. */
export async function resetData(t: TestApp): Promise<void> {
  const r = await t.db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('spatial_ref_sys')`);
  const names = r.rows.map((x) => `"${x.tablename}"`).join(', ');
  if (names) await t.db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
  await seedCatalog(t.db);
  await t.redis.flushdb();
  Outbox.clear();
}

export function lastCode(phone: string): string {
  const e = Outbox.latestTo(phone);
  const m = e?.body.match(/\d{6}/);
  if (!m) throw new Error(`no code sent to ${phone}`);
  return m[0];
}

let ipCounter = 1;
/** Each test flow gets its own client IP so per-IP rate limits don't bleed across tests. */
export const freshIp = () => `10.${(process.pid % 200) + 1}.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

export const normalize = (p: string) => (p.startsWith('+') ? p : `+2${p}`);

export async function customerSession(t: TestApp, phone: string, ip = freshIp()) {
  const req = await t.http.post('/v1/auth/otp/request').set('x-forwarded-for', ip).send({ phone, turnstileToken: 'pass' }).expect(200);
  const res = await t.http.post('/v1/auth/otp/verify').set('x-forwarded-for', ip).send({ challengeId: req.body.challengeId, phone, code: lastCode(normalize(phone)), client: 'mobile' }).expect(200);
  return { token: res.body.tokens.accessToken as string, refresh: res.body.tokens.refreshToken as string, userId: res.body.user.id as string };
}

/** Registers a dealer owner (OTP proof → password → TOTP) and returns a dealer-scope bearer token. */
export async function dealerOwner(t: TestApp, phone: string, ip = freshIp()) {
  const r = await t.http.post('/v1/auth/otp/request').set('x-forwarded-for', ip).send({ phone, purpose: 'dealer_sign_up', turnstileToken: 'pass' }).expect(200);
  const proof = await t.http.post('/v1/auth/otp/proof').set('x-forwarded-for', ip).send({ challengeId: r.body.challengeId, phone, code: lastCode(normalize(phone)) }).expect(200);
  const reg = await t.http.post('/v1/auth/dealer/register').send({ phoneProof: proof.body.phoneProof, password: 'correct horse battery', displayName: 'Owner Test' }).expect(201);
  const conf = await t.http.post('/v1/auth/dealer/totp/confirm').send({ setupToken: reg.body.setupToken, code: currentTotp(reg.body.totp.secret), client: 'mobile' }).expect(200);
  return { token: conf.body.tokens.accessToken as string, totpSecret: reg.body.totp.secret as string };
}

export async function adminSession(t: TestApp, email = 'ops@agarha.com', roles: string[] = ['admin']) {
  const users = t.app.get(UsersService, { strict: false });
  const u = await users.findOrCreateByPhone(`+2011${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, 'en');
  await users.grantRoles(u.id, roles as never);
  await users.linkIdentity(u.id, 'google_workspace', `dev:${email}`, email);
  const step1 = await t.http.post('/v1/auth/admin/dev-login').send({ email }).expect(200);
  const setup = await t.http.post('/v1/auth/admin/totp/setup').send({ setupToken: step1.body.setupToken, code: currentTotp(step1.body.totp.secret) }).expect(200);
  const cookies = setup.headers['set-cookie'] as unknown as string[];
  const at = cookies.find((c) => c.startsWith('ag_a_at='))!.split(';')[0]!.split('=')[1]!;
  return { token: at, userId: u.id };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
