import type { Locale } from '@agarha/schemas';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db';
import { notificationDeliveries, notificationPreferences, pushTokens } from '../../db/schema/notifications';
import { Queues } from '../../infra/queue/queues';
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
  ProviderError,
  WHATSAPP_PROVIDER,
  type EmailProvider,
  type PushProvider,
  type WhatsAppProvider,
} from './channels';
import { ENV, type Env } from '../../config/env';
import { msUntilQuietEnds } from './quiet-hours';
import { TEMPLATE_TOPIC, TEMPLATES, render, type TemplateId } from './templates';

export type Channel = 'push' | 'whatsapp' | 'email';

export interface NotifyRequest {
  template: TemplateId;
  locale: Locale;
  vars: Record<string, string | number>;
  /** Try channels in order; the first one the recipient has (and hasn't opted out of) is used. */
  channels: Channel[];
  userId?: string | null;
  /** Required for whatsapp/email if there's no user, e.g. a dealer's business WhatsApp. */
  whatsappTo?: string;
  emailTo?: string;
  data?: Record<string, string>;
  related?: { type: string; id: string };
  /** Delay (e.g. review prompt 24h after lead). */
  delayMs?: number;
}

/** Queued, retried, preference- and quiet-hours-aware notifications. The worker calls deliver(). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly queues: Queues,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  private async optedOut(userId: string, topic: string, channel: Channel): Promise<boolean> {
    const [pref] = await this.db
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.topic, topic), eq(notificationPreferences.channel, channel)));
    return pref ? !pref.enabled : false;
  }

  /** Resolves channel + recipient, records a queued delivery and enqueues it. Returns delivery ids. */
  async notify(req: NotifyRequest): Promise<string[]> {
    const meta = TEMPLATE_TOPIC[req.template];
    for (const channel of req.channels) {
      if (req.userId && !meta.transactional && (await this.optedOut(req.userId, meta.topic, channel))) continue;
      const recipients = await this.recipients(req, channel);
      if (!recipients.length) continue;

      const ids: string[] = [];
      for (const recipient of recipients) {
        const [row] = await this.db
          .insert(notificationDeliveries)
          .values({
            userId: req.userId ?? null,
            recipient,
            channel,
            template: req.template,
            locale: req.locale,
            status: 'queued',
            relatedType: req.related?.type ?? null,
            relatedId: req.related?.id ?? null,
            payload: { template: req.template, locale: req.locale, vars: req.vars, ...(req.data ? { data: req.data } : {}) },
          })
          .returning({ id: notificationDeliveries.id });
        ids.push(row!.id);
      }
      const due = new Date(Date.now() + (req.delayMs ?? 0));
      const delay = (req.delayMs ?? 0) + (meta.transactional ? 0 : msUntilQuietEnds(due));
      for (const deliveryId of ids)
        await this.queues.add('notifications', { deliveryId }, { delay, jobId: deliveryId });
      return ids;
    }
    this.logger.debug({ template: req.template }, 'no reachable channel, notification skipped');
    return [];
  }

  private async recipients(req: NotifyRequest, channel: Channel): Promise<string[]> {
    if (channel === 'whatsapp') return req.whatsappTo ? [req.whatsappTo] : [];
    if (channel === 'email') return req.emailTo ? [req.emailTo] : [];
    if (!req.userId) return [];
    const rows = await this.db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, req.userId));
    return rows.map((r) => r.token);
  }

  /** Worker entry point. Throws on retryable failure so BullMQ backs off and retries. */
  async deliver(deliveryId: string, attempt: number): Promise<void> {
    const [d] = await this.db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, deliveryId));
    if (!d || d.status === 'sent' || d.status === 'delivered') return;
    const req = d.payload;
    if (!req) {
      await this.mark(deliveryId, 'failed', attempt, 'missing payload');
      return;
    }
    const { title, body } = render(req.template, req.locale, req.vars);
    try {
      let result: { provider: string; providerMessageId?: string };
      if (d.channel === 'push') result = await this.push.send({ to: d.recipient, title, body, ...(req.data ? { data: req.data } : {}) });
      else if (d.channel === 'email') result = await this.email.send({ to: d.recipient, subject: title, text: body });
      else {
        const kind = (TEMPLATES[req.template] as { whatsapp?: 'lead' | 'nudge' }).whatsapp;
        const template = kind === 'lead' ? this.env.WHATSAPP_LEAD_TEMPLATE : kind === 'nudge' ? this.env.WHATSAPP_NUDGE_TEMPLATE : req.template;
        result = await this.whatsapp.sendTemplate({ to: d.recipient, template, locale: req.locale, params: Object.values(req.vars).map(String) });
      }
      await this.db
        .update(notificationDeliveries)
        .set({ status: 'sent', provider: result.provider, providerMessageId: result.providerMessageId ?? null, attempts: attempt, lastError: null })
        .where(eq(notificationDeliveries.id, deliveryId));
    } catch (err) {
      const retryable = !(err instanceof ProviderError) || err.retryable;
      await this.mark(deliveryId, retryable ? 'queued' : 'failed', attempt, (err as Error).message);
      if (d.channel === 'push' && err instanceof ProviderError && !err.retryable)
        await this.db.delete(pushTokens).where(eq(pushTokens.token, d.recipient));
      if (retryable) throw err;
    }
  }

  async markFinalFailure(deliveryId: string, attempt: number, error: string): Promise<void> {
    await this.mark(deliveryId, 'failed', attempt, error);
  }

  private async mark(id: string, status: 'queued' | 'failed', attempts: number, error: string) {
    await this.db.update(notificationDeliveries).set({ status, attempts, lastError: error.slice(0, 500) }).where(eq(notificationDeliveries.id, id));
  }

  /** Provider status callbacks (WhatsApp/SMS delivery reports). */
  async applyDeliveryStatus(provider: string, providerMessageId: string, status: 'sent' | 'delivered' | 'failed', error?: string) {
    await this.db
      .update(notificationDeliveries)
      .set({ status, ...(error ? { lastError: error.slice(0, 500) } : {}) })
      .where(and(eq(notificationDeliveries.provider, provider), eq(notificationDeliveries.providerMessageId, providerMessageId)));
  }
}
