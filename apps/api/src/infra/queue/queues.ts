import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis';

/** Queue names and job payloads shared by the API (producer) and the worker (consumer). */
export const QUEUE = {
  notifications: 'notifications',
  media: 'media',
  scheduled: 'scheduled',
  events: 'events',
} as const;
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export interface JobPayloads {
  notifications: { deliveryId: string };
  media: { kind: 'listing_photo'; photoId: string } | { kind: 'verification_doc'; docId: string };
  scheduled:
    | { job: 'freshness' }
    | { job: 'availability_nudges' }
    | { job: 'saved_search_matching' }
    | { job: 'sitemap' }
    | { job: 'retention' }
    | { job: 'featured_expiry' }
    | { job: 'subscription_renewals' }
    | { job: 'otp_synthetic' };
  events: { name: string; payload: Record<string, unknown>; occurredAt: string };
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 7 * 86_400 },
};

@Injectable()
export class Queues implements OnApplicationShutdown {
  private readonly queues = new Map<QueueName, Queue>();
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  get(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.redis, defaultJobOptions: DEFAULT_JOB_OPTIONS });
      this.queues.set(name, q);
    }
    return q;
  }

  async add<N extends keyof JobPayloads>(
    name: N,
    data: JobPayloads[N],
    opts: JobsOptions = {},
  ): Promise<void> {
    const jobName =
      'job' in (data as object) ? String((data as { job: string }).job) : String(name);
    await this.get(QUEUE[name]).add(jobName, data, opts);
  }

  async onApplicationShutdown() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

@Global()
@Module({ providers: [Queues], exports: [Queues] })
export class QueueModule {}
