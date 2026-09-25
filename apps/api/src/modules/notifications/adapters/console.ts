// Local/test adapters. They record every message in memory (read by tests and the local
// dev inbox endpoint) instead of sending it. Refused in production by env validation.
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  EmailMessage,
  EmailProvider,
  PushMessage,
  PushProvider,
  SendResult,
  SmsProvider,
  WhatsAppProvider,
  WhatsAppTemplateMessage,
} from '../channels';

export interface OutboxEntry {
  channel: 'sms' | 'whatsapp' | 'push' | 'email';
  to: string;
  body: string;
  meta?: Record<string, unknown>;
  at: Date;
}

export class Outbox {
  static readonly entries: OutboxEntry[] = [];
  /** Tests can make the next N sends of a provider fail to exercise failover. */
  static readonly failNext = new Map<string, number>();

  static record(e: Omit<OutboxEntry, 'at'>): void {
    Outbox.entries.push({ ...e, at: new Date() });
    if (Outbox.entries.length > 500) Outbox.entries.shift();
  }
  static latestTo(to: string, channel?: OutboxEntry['channel']): OutboxEntry | undefined {
    return [...Outbox.entries]
      .reverse()
      .find((e) => e.to === to && (!channel || e.channel === channel));
  }
  static clear(): void {
    Outbox.entries.length = 0;
    Outbox.failNext.clear();
  }
  static shouldFail(provider: string): boolean {
    const n = Outbox.failNext.get(provider) ?? 0;
    if (n > 0) Outbox.failNext.set(provider, n - 1);
    return n > 0;
  }
}

const logger = new Logger('ConsoleProvider');
const ok = (provider: string): SendResult => ({ provider, providerMessageId: randomUUID() });

export class ConsoleSmsProvider implements SmsProvider {
  constructor(readonly name = 'console') {}
  async send(to: string, body: string): Promise<SendResult> {
    if (Outbox.shouldFail(this.name)) throw new Error(`${this.name}: simulated failure`);
    Outbox.record({ channel: 'sms', to, body });
    logger.log(`SMS to ${to}: ${body}`);
    return ok(this.name);
  }
}

export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'console-whatsapp';
  async sendTemplate(msg: WhatsAppTemplateMessage): Promise<SendResult> {
    if (Outbox.shouldFail(this.name)) throw new Error(`${this.name}: simulated failure`);
    Outbox.record({
      channel: 'whatsapp',
      to: msg.to,
      body: msg.params.join(' | '),
      meta: { template: msg.template },
    });
    logger.log(`WhatsApp ${msg.template} to ${msg.to}: ${msg.params.join(' | ')}`);
    return ok(this.name);
  }
}

export class ConsolePushProvider implements PushProvider {
  readonly name = 'console-push';
  async send(msg: PushMessage): Promise<SendResult> {
    Outbox.record({
      channel: 'push',
      to: msg.to,
      body: `${msg.title}: ${msg.body}`,
      meta: msg.data,
    });
    return ok(this.name);
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console-email';
  async send(msg: EmailMessage): Promise<SendResult> {
    Outbox.record({ channel: 'email', to: msg.to, body: `${msg.subject}\n${msg.text}` });
    return ok(this.name);
  }
}
