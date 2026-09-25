import { ProviderError, type SendResult, type SmsProvider } from '../channels';
import { postForm } from './http';

/** Vonage SMS API. `type=unicode` so Arabic text is sent correctly. */
export class VonageSmsProvider implements SmsProvider {
  readonly name = 'vonage';
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly from: string,
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    const res = (await postForm(this.name, 'https://rest.nexmo.com/sms/json', {
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      from: this.from,
      to: to.replace(/^\+/, ''),
      text: body,
      type: 'unicode',
    })) as { messages?: { status: string; 'message-id'?: string; 'error-text'?: string }[] };
    const m = res.messages?.[0];
    if (!m || m.status !== '0') {
      // Status 1 = throttled (retryable); most others are permanent (invalid number, barred).
      throw new ProviderError(this.name, m?.['error-text'] ?? 'unknown error', m?.status === '1');
    }
    return { provider: this.name, ...(m['message-id'] ? { providerMessageId: m['message-id'] } : {}) };
  }
}
