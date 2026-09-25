import { ProviderError, type PushMessage, type PushProvider, type SendResult } from '../channels';
import { postJson } from './http';

export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';
  constructor(private readonly accessToken: string) {}

  async send(msg: PushMessage): Promise<SendResult> {
    const res = (await postJson(
      this.name,
      'https://exp.host/--/api/v2/push/send',
      { to: msg.to, title: msg.title, body: msg.body, data: msg.data ?? {}, sound: 'default' },
      { authorization: `Bearer ${this.accessToken}`, accept: 'application/json' },
    )) as {
      data?: { status: string; id?: string; message?: string; details?: { error?: string } };
    };
    if (res.data?.status !== 'ok')
      throw new ProviderError(
        this.name,
        res.data?.message ?? 'push failed',
        res.data?.details?.error !== 'DeviceNotRegistered',
      );
    return { provider: this.name, ...(res.data.id ? { providerMessageId: res.data.id } : {}) };
  }
}
