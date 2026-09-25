import { interpolate, messages } from '@agarha/i18n';
import type { Locale, OtpChannel } from '@agarha/schemas';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db';
import { notificationDeliveries } from '../../db/schema/notifications';
import { SMS_PROVIDERS, WHATSAPP_PROVIDER, type SmsProvider, type WhatsAppProvider } from './channels';

export interface OtpSendRequest {
  phone: string;
  code: string;
  locale: Locale;
  preferred: OtpChannel;
  ttlMinutes: number;
  challengeId: string;
}

export class OtpDeliveryFailed extends Error {}

/**
 * OTP is sent synchronously (the client must know which channel to watch).
 * Order: preferred channel first, then every other SMS provider, then WhatsApp as the fallback channel.
 * Every attempt is logged in notification_deliveries.
 */
@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger('OtpDelivery');

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    @Inject(SMS_PROVIDERS) private readonly sms: SmsProvider[],
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  async send(req: OtpSendRequest): Promise<{ channel: OtpChannel; provider: string }> {
    const body = interpolate(messages[req.locale].otpMessage.body, { code: req.code, minutes: req.ttlMinutes });
    type Attempt = { channel: OtpChannel; name: string; run: () => Promise<{ provider: string; providerMessageId?: string }> };
    const smsAttempts: Attempt[] = this.sms.map((p) => ({ channel: 'sms', name: p.name, run: () => p.send(req.phone, body) }));
    const waAttempt: Attempt[] = this.env.WHATSAPP_OTP_ENABLED
      ? [{
          channel: 'whatsapp',
          name: this.whatsapp.name,
          run: () => this.whatsapp.sendTemplate({ to: req.phone, template: this.env.WHATSAPP_OTP_TEMPLATE, locale: req.locale, params: [req.code], buttonParam: req.code }),
        }]
      : [];
    const attempts = req.preferred === 'whatsapp' ? [...waAttempt, ...smsAttempts] : [...smsAttempts, ...waAttempt];

    for (const a of attempts) {
      try {
        const r = await a.run();
        await this.log(req, a.channel, r.provider, 'sent', r.providerMessageId);
        return { channel: a.channel, provider: r.provider };
      } catch (err) {
        this.logger.warn({ provider: a.name, err: (err as Error).message }, 'OTP provider failed, trying next');
        await this.log(req, a.channel, a.name, 'failed', undefined, (err as Error).message);
      }
    }
    throw new OtpDeliveryFailed('all OTP providers failed');
  }

  private async log(req: OtpSendRequest, channel: OtpChannel, provider: string, status: 'sent' | 'failed', providerMessageId?: string, error?: string) {
    await this.db.insert(notificationDeliveries).values({
      recipient: req.phone,
      channel,
      template: 'otp',
      locale: req.locale,
      provider,
      providerMessageId: providerMessageId ?? null,
      status,
      attempts: 1,
      lastError: error?.slice(0, 500) ?? null,
      relatedType: 'otp_challenge',
      relatedId: req.challengeId,
    });
  }
}
