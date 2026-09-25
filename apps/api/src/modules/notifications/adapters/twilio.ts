import type { SendResult, SmsProvider } from '../channels';
import { postForm } from './http';

/** Twilio Programmable Messaging via a Messaging Service (sender pool + alphanumeric sender). */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly messagingServiceSid: string,
    private readonly statusCallback?: string,
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    const form: Record<string, string> = {
      To: to,
      MessagingServiceSid: this.messagingServiceSid,
      Body: body,
    };
    if (this.statusCallback) form.StatusCallback = this.statusCallback;
    const res = (await postForm(
      this.name,
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      form,
      {
        authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
      },
    )) as { sid?: string };
    return { provider: this.name, ...(res.sid ? { providerMessageId: res.sid } : {}) };
  }
}
