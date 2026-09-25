import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { lt, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB, type Database } from '../db/db';
import { notificationDeliveries } from '../db/schema/notifications';
import { FlagsService } from '../infra/flags';
import { QUEUE, Queues, type JobPayloads } from '../infra/queue/queues';
import { REDIS } from '../infra/redis/redis';
import { captureException } from '../infra/observability';
import { BillingService } from '../modules/billing';
import { AvailabilityService, LeadsService } from '../modules/leads';
import { ListingsService } from '../modules/listings';
import { NotificationsService } from '../modules/notifications';
import { SearchService } from '../modules/search';
import { VerificationService } from '../modules/verification';
import { SCHEDULES } from './jobs';

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
  ) {}

  /** One scheduled job, callable directly (tests, runbooks: `pnpm worker:run freshness`). */
  async runScheduled(job: JobPayloads['scheduled']['job']): Promise<unknown> {
    switch (job) {
      case 'freshness':
        return this.listings.runFreshness();
      case 'availability_nudges':
        return this.listings.runNudges();
      case 'saved_search_matching':
        return this.search.runSavedSearchMatching();
      case 'sitemap':
        return { ...(await this.search.reindexAll()), sitemap: !!(await this.search.rebuildSitemap()) };
      case 'retention': {
        const leads = await this.leads.purgeExpired();
        const docs = await this.verification.purgeExpired();
        const deliveries = await this.db.delete(notificationDeliveries).where(lt(notificationDeliveries.createdAt, sql`now() - interval '90 days'`)).returning({ id: notificationDeliveries.id });
        return { leads, docs, deliveries: deliveries.length };
      }
      case 'subscription_renewals':
        return this.billing.runRenewals();
      case 'featured_expiry':
        return { expiredRequests: await this.availability.expireOld() };
    }
  }

  async onApplicationBootstrap() {
    const connection = this.redis;
    const scheduled = this.queues.get(QUEUE.scheduled);
    for (const s of SCHEDULES) await scheduled.upsertJobScheduler(s.job, { pattern: s.pattern, tz: 'Africa/Cairo' }, { name: s.job, data: { job: s.job } });

    this.workers.push(
      new Worker<JobPayloads['notifications']>(QUEUE.notifications, async (job) => this.notifications.deliver(job.data.deliveryId, job.attemptsMade + 1), { connection, concurrency: 10 }),
      new Worker<JobPayloads['media']>(
        QUEUE.media,
        async (job) => (job.data.kind === 'listing_photo' ? this.listings.processPhoto(job.data.photoId) : this.verification.process(job.data.docId)),
        { connection, concurrency: 2 },
      ),
      new Worker<JobPayloads['scheduled']>(QUEUE.scheduled, async (job) => this.runScheduled(job.data.job), { connection, concurrency: 1 }),
      new Worker<JobPayloads['events']>(
        QUEUE.events,
        async (job) => {
          // Domain events -> product analytics (no PII: ids only).
          this.flags.capture({ event: job.data.name.replace('.', '_'), distinctId: 'server', properties: job.data.payload });
        },
        { connection, concurrency: 5 },
      ),
    );
    for (const w of this.workers) {
      w.on('failed', (job: Job | undefined, err) => {
        this.logger.error({ queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed');
        if (job && w.name === QUEUE.notifications && job.attemptsMade >= (job.opts.attempts ?? 1))
          void this.notifications.markFinalFailure((job.data as { deliveryId: string }).deliveryId, job.attemptsMade, err.message);
        captureException(err);
      });
    }
    this.logger.log(`worker started: ${this.workers.map((w) => w.name).join(', ')}`);
  }

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
