import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { QUEUE, Queues } from '../infra/queue/queues';
import { NotificationsService } from '../modules/notifications';

const EVERY_MS = 60_000;

/** CloudWatch Embedded Metric Format: the log line itself becomes metrics (no agent, no SDK). */
export function emf<V extends Record<string, number>>(env: string, values: V, now = Date.now()) {
  return {
    _aws: {
      Timestamp: now,
      CloudWatchMetrics: [
        {
          Namespace: 'Agarha',
          Dimensions: [['Environment']],
          Metrics: Object.keys(values).map((Name) => ({
            Name,
            Unit: Name.endsWith('Seconds')
              ? 'Seconds'
              : Name.endsWith('Percent')
                ? 'Percent'
                : 'Count',
          })),
        },
      ],
    },
    Environment: env,
    ...values,
  };
}

/**
 * Operational metrics for alarms (section 10): oldest waiting job per queue (backlog > 5 min) and
 * the OTP delivery failure rate over 15 minutes (> 10%). One log line per minute.
 */
@Injectable()
export class MetricsReporter implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Metrics');
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly queues: Queues,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(
      () =>
        void this.report().catch((err: Error) =>
          this.logger.warn({ err: err.message }, 'metrics report failed'),
        ),
      EVERY_MS,
    );
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async report(now = Date.now()): Promise<Record<string, number>> {
    let oldest = 0;
    for (const name of Object.values(QUEUE)) {
      const [job] = await this.queues.get(name).getWaiting(0, 0);
      if (job) oldest = Math.max(oldest, Math.round((now - job.timestamp) / 1000));
    }
    const otp = await this.notifications.otpDeliveryStats(15);
    const values = {
      QueueOldestWaitSeconds: oldest,
      OtpSendAttempts: otp.total,
      OtpFailurePercent: otp.total ? Math.round((otp.failed / otp.total) * 1000) / 10 : 0,
    };
    this.logger.log(emf(this.env.APP_ENV, values, now), 'metrics');
    return values;
  }
}
