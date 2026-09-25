import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { lt, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../db/db';
import { auditLog } from '../db/schema/admin';
import { otpChallenges, refreshTokens } from '../db/schema/identity';
import { reports } from '../db/schema/moderation';
import { notificationDeliveries } from '../db/schema/notifications';
import { FlagsService } from '../infra/flags';
import { QUEUE, Queues, type JobPayloads } from '../infra/queue/queues';
import { REDIS } from '../infra/redis/redis';
import { captureException } from '../infra/observability';
import { BillingService } from '../modules/billing';
import { OtpService } from '../modules/identity';
import { AvailabilityService, LeadsService } from '../modules/leads';
import { ListingsService } from '../modules/listings';
import { NotificationsService } from '../modules/notifications';
import { SearchService } from '../modules/search';
import { VerificationService } from '../modules/verification';
import { SCHEDULES } from './jobs';
import { emf } from './metrics';

@Injectable()
export class Processors implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Worker');
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DB) private readonly db: Database,
    private readonly queues: Queues,
    private readonly notifications: NotificationsService,
    private readonly listings: ListingsService,
    private readonly verification: VerificationService,
    private readonly search: SearchService,
    private readonly leads: LeadsService,
    private readonly availability: AvailabilityService,
    private readonly billing: BillingService,
    private readonly flags: FlagsService,
    private readonly otp: OtpService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** One scheduled job, callable directly (tests, runbooks: `pnpm --filter @agarha/api worker:run freshness`). */
  async runScheduled(job: JobPayloads['scheduled']['job']): Promise<unknown> {
    switch (job) {
      case 'freshness':
        return this.listings.runFreshness();
      case 'availability_nudges':
        return this.listings.runNudges();
      case 'saved_search_matching':
        return this.search.runSavedSearchMatching();
      case 'sitemap':
        return {
          ...(await this.search.reindexAll()),
          sitemap: !!(await this.search.rebuildSitemap()),
        };
      case 'retention': {
        const leads = await this.leads.purgeExpired();
        const docs = await this.verification.purgeExpired();
        const deliveries = await this.db
          .delete(notificationDeliveries)
          .where(lt(notificationDeliveries.createdAt, sql`now() - interval '90 days'`))
          .returning({ id: notificationDeliveries.id });
        const purge = async (q: PromiseLike<unknown[]>) => (await q).length;
        return {
          leads,
          docs,
          deliveries: deliveries.length,
          otpChallenges: await purge(
            this.db
              .delete(otpChallenges)
              .where(lt(otpChallenges.createdAt, sql`now() - interval '1 day'`))
              .returning({ id: otpChallenges.id }),
          ),
          refreshTokens: await purge(
            this.db
              .delete(refreshTokens)
              .where(lt(refreshTokens.expiresAt, sql`now() - interval '7 days'`))
              .returning({ id: refreshTokens.id }),
          ),
          reports: await purge(
            this.db
              .delete(reports)
              .where(lt(reports.createdAt, sql`now() - interval '24 months'`))
              .returning({ id: reports.id }),
          ),
          auditLog: await purge(
            this.db
              .delete(auditLog)
              .where(lt(auditLog.createdAt, sql`now() - interval '24 months'`))
              .returning({ id: auditLog.id }),
          ),
        };
      }
      case 'subscription_renewals':
        return this.billing.runRenewals();
      case 'otp_synthetic': {
        if (!this.env.SYNTHETIC_OTP_PHONE) return { skipped: 'SYNTHETIC_OTP_PHONE not set' };
        let ok = 0;
        let result: Record<string, unknown>;
        try {
          result = { ok: true, ...(await this.otp.synthetic(this.env.SYNTHETIC_OTP_PHONE)) };
          ok = 1;
        } catch (err) {
          result = { ok: false, error: (err as Error).message };
        }
        // Alarm source: Agarha/OtpSyntheticOk (infra/terraform/observability.tf).
        this.logger.log(emf(this.env.APP_ENV, { OtpSyntheticOk: ok }), 'metrics');
        return result;
      }
      case 'featured_expiry':
        return { expiredRequests: await this.availability.expireOld() };
    }
  }

  async onApplicationBootstrap() {
    const connection = this.redis;
    const scheduled = this.queues.get(QUEUE.scheduled);
    for (const s of SCHEDULES)
      await scheduled.upsertJobScheduler(
        s.job,
        { pattern: s.pattern, tz: 'Africa/Cairo' },
        { name: s.job, data: { job: s.job } },
      );

    this.workers.push(
      new Worker<JobPayloads['notifications']>(
        QUEUE.notifications,
        async (job) => this.notifications.deliver(job.data.deliveryId, job.attemptsMade + 1),
        { connection, concurrency: 10 },
      ),
      new Worker<JobPayloads['media']>(
        QUEUE.media,
        async (job) =>
          job.data.kind === 'listing_photo'
            ? this.listings.processPhoto(job.data.photoId)
            : this.verification.process(job.data.docId),
        { connection, concurrency: 2 },
      ),
      new Worker<JobPayloads['scheduled']>(
        QUEUE.scheduled,
        async (job) => this.runScheduled(job.data.job),
        { connection, concurrency: 1 },
      ),
      new Worker<JobPayloads['events']>(
        QUEUE.events,
        async (job) => {
          // Domain events -> product analytics (no PII: ids only).
          this.flags.capture({
            event: job.data.name.replace('.', '_'),
            distinctId: 'server',
            properties: job.data.payload,
          });
        },
        { connection, concurrency: 5 },
      ),
    );
    for (const w of this.workers) {
      w.on('failed', (job: Job | undefined, err) => {
        this.logger.error(
          { queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
          'job failed',
        );
        if (job && w.name === QUEUE.notifications && job.attemptsMade >= (job.opts.attempts ?? 1))
          void this.notifications.markFinalFailure(
            (job.data as { deliveryId: string }).deliveryId,
            job.attemptsMade,
            err.message,
          );
        captureException(err);
      });
    }
    this.logger.log(`worker started: ${this.workers.map((w) => w.name).join(', ')}`);
  }

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
