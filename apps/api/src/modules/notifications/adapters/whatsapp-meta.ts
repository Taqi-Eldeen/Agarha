import type { SendResult, WhatsAppProvider, WhatsAppTemplateMessage } from '../channels';
import { postJson } from './http';

/** WhatsApp Business Platform (Cloud API), template messages only (we never start free-form chats). */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta-whatsapp';
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
    private readonly graphVersion: string,
  ) {}

  async sendTemplate(msg: WhatsAppTemplateMessage): Promise<SendResult> {
    const components: unknown[] = [
      { type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text })) },
    ];
    if (msg.buttonParam)
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: msg.buttonParam }],
      });
    const res = (await postJson(
      this.name,
      `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: msg.to.replace(/^\+/, ''),
        type: 'template',
        template: { name: msg.template, language: { code: msg.locale }, components },
      },
      { authorization: `Bearer ${this.accessToken}` },
    )) as { messages?: { id: string }[] };
    const id = res.messages?.[0]?.id;
    return { provider: this.name, ...(id ? { providerMessageId: id } : {}) };
  }
}
