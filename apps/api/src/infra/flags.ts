import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { ENV, type Env } from '../config/env';

/** Known flags. Unfinished features stay behind these (section 10). */
export const FLAGS = {
  publicSite: 'public_site',
  searchEngine: 'search_engine_meilisearch',
  availabilityRequests: 'availability_requests',
  csvImport: 'csv_import',
  billing: 'billing',
  reviews: 'reviews',
} as const;
export type Flag = (typeof FLAGS)[keyof typeof FLAGS];

export interface AnalyticsEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

/** PostHog for flags + product analytics; env FLAGS forces flags on (local, tests, emergencies). */
@Injectable()
export class FlagsService implements OnApplicationShutdown {
  private readonly logger = new Logger('Flags');
  private readonly ph: PostHog | null;
  private readonly forced: Set<string>;
  readonly captured: AnalyticsEvent[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.forced = new Set(env.FLAGS);
    this.ph = env.POSTHOG_API_KEY
      ? new PostHog(env.POSTHOG_API_KEY, {
          host: env.POSTHOG_HOST,
          flushAt: 20,
          flushInterval: 10_000,
        })
      : null;
  }

  async isEnabled(flag: Flag, distinctId = 'server'): Promise<boolean> {
    if (this.forced.has(flag) || this.forced.has('*')) return true;
    if (!this.ph) return false;
    try {
      return (await this.ph.isFeatureEnabled(flag, distinctId)) === true;
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, flag }, 'flag lookup failed, defaulting off');
      return false;
    }
  }

  /** Server-side analytics. Never send phone numbers or names as properties. */
  capture(e: AnalyticsEvent): void {
    if (this.ph)
      this.ph.capture({ event: e.event, distinctId: e.distinctId, properties: e.properties ?? {} });
    else {
      this.captured.push(e);
      if (this.captured.length > 1000) this.captured.shift();
    }
  }

  async onApplicationShutdown() {
    await this.ph?.shutdown();
  }
}

@Global()
@Module({ providers: [FlagsService], exports: [FlagsService] })
export class FlagsModule {}
