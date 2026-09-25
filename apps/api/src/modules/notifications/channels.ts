import type { Locale } from '@agarha/schemas';

export interface SendResult {
  provider: string;
  providerMessageId?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SendResult>;
}

export interface WhatsAppTemplateMessage {
  to: string;
  template: string;
  locale: Locale;
  /** Body parameters in order. */
  params: string[];
  /** Authentication templates need the code again as a URL/copy button parameter. */
  buttonParam?: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendTemplate(msg: WhatsAppTemplateMessage): Promise<SendResult>;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
export interface PushProvider {
  readonly name: string;
  send(msg: PushMessage): Promise<SendResult>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    /** false = don't retry (e.g. invalid number). */
    readonly retryable = true,
  ) {
    super(`${provider}: ${message}`);
  }
}

export const SMS_PROVIDERS = Symbol('SMS_PROVIDERS');
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
