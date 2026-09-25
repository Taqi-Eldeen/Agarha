import { sql } from 'drizzle-orm';
import { auditLog } from '../src/db/schema/admin';
import { otpChallenges, refreshTokens } from '../src/db/schema/identity';
import { reports } from '../src/db/schema/moderation';
import { FlagsService } from '../src/infra/flags';
import { Queues } from '../src/infra/queue/queues';
import { BillingService } from '../src/modules/billing';
import { OtpService } from '../src/modules/identity';
import { AvailabilityService, LeadsService } from '../src/modules/leads';
import { ListingsService } from '../src/modules/listings';
import { NotificationsService } from '../src/modules/notifications';
import { SearchService } from '../src/modules/search';
import { VerificationService } from '../src/modules/verification';
import { Processors } from '../src/worker/processors';
import { liveListing, verifiedDealer } from './fixtures';
import { bearer, createTestApp, customerSession, resetData, type TestApp } from './helpers';

describe('scheduled jobs: retention and synthetic OTP', () => {
  let t: TestApp;
  let processors: Processors;
  let build: (env: TestApp['env']) => Processors;
  beforeAll(async () => {
    t = await createTestApp();
    const get = <T>(c: abstract new (...a: never[]) => T) => t.app.get(c, { strict: false });
    // Built by hand: the worker's bootstrap hook (BullMQ consumers, schedules) is not wanted here.
    build = (env) =>
      new Processors(
        t.redis,
        t.db,
        get(Queues),
        get(NotificationsService),
        get(ListingsService),
        get(VerificationService),
        get(SearchService),
        get(LeadsService),
        get(AvailabilityService),
        get(BillingService),
        get(FlagsService),
        get(OtpService),
        env,
      );
    processors = build(t.env);
  });
  beforeEach(() => resetData(t));
  afterAll(() => t.close());

  const count = async (
    table: typeof otpChallenges | typeof refreshTokens | typeof reports | typeof auditLog,
  ) => (await t.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]!.n;

  it('purges old OTP challenges, expired sessions, and reports/audit entries past 24 months', async () => {
    const d = await verifiedDealer(t, '01031000001');
    const car = await liveListing(t, d);
    const c = await customerSession(t, '01031000100');
    await t.http
      .post('/v1/reports')
      .set(bearer(c.token))
      .send({ listingId: car, reason: 'scam_or_deposit_request' })
      .expect(201);
    const before = {
      otp: await count(otpChallenges),
      sessions: await count(refreshTokens),
      reports: await count(reports),
      audit: await count(auditLog),
    };
    expect(before.otp).toBeGreaterThan(0);
    expect(before.reports).toBe(1);
    expect(before.audit).toBeGreaterThan(0);

    // Nothing is old yet: the job keeps everything.
    await processors.runScheduled('retention');
    expect(await count(otpChallenges)).toBe(before.otp);
    expect(await count(refreshTokens)).toBe(before.sessions);

    await t.db.update(otpChallenges).set({ createdAt: sql`now() - interval '2 days'` });
    await t.db.update(refreshTokens).set({ expiresAt: sql`now() - interval '8 days'` });
    await t.db.update(reports).set({ createdAt: sql`now() - interval '25 months'` });
    await t.db.update(auditLog).set({ createdAt: sql`now() - interval '25 months'` });
    const result = (await processors.runScheduled('retention')) as Record<string, number>;
    expect(result).toMatchObject({
      otpChallenges: before.otp,
      refreshTokens: before.sessions,
      reports: 1,
      auditLog: before.audit,
    });
    expect(await count(otpChallenges)).toBe(0);
    expect(await count(reports)).toBe(0);
  });

  it('synthetic OTP: skipped when unconfigured; otherwise sends and verifies through the real pipeline', async () => {
    expect(await processors.runScheduled('otp_synthetic')).toEqual({
      skipped: 'SYNTHETIC_OTP_PHONE not set',
    });
    const withPhone = build({ ...t.env, SYNTHETIC_OTP_PHONE: '+201012345678' });
    expect(await withPhone.runScheduled('otp_synthetic')).toMatchObject({
      ok: true,
      channel: 'sms',
    });
    const [c] = await t.db.select().from(otpChallenges);
    expect(c).toMatchObject({ phoneE164: '+201012345678', attempts: 0 });
    expect(c!.consumedAt).not.toBeNull();
  });
});
