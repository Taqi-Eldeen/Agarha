import type { EmailMessage, EmailProvider, SendResult } from '../channels';
import { postJson } from './http';

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(msg: EmailMessage): Promise<SendResult> {
    const res = (await postJson(
      this.name,
      'https://api.resend.com/emails',
      { from: this.from, to: [msg.to], subject: msg.subject, text: msg.text },
      { authorization: `Bearer ${this.apiKey}` },
    )) as { id?: string };
    return { provider: this.name, ...(res.id ? { providerMessageId: res.id } : {}) };
  }
}
