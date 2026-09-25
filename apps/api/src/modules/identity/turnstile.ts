import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';

export const TURNSTILE = Symbol('TURNSTILE');

export interface TurnstileVerifier {
  verify(token: string, remoteIp?: string): Promise<boolean>;
}

/** Cloudflare Turnstile siteverify. Fails closed on network errors. */
@Injectable()
export class CloudflareTurnstile implements TurnstileVerifier {
  private readonly logger = new Logger('Turnstile');
  constructor(@Inject(ENV) private readonly env: Env) {}

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const form = new URLSearchParams({ secret: this.env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) form.set('remoteip', remoteIp);
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(5000),
      });
      const body = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (!body.success) this.logger.warn({ codes: body['error-codes'] }, 'turnstile rejected');
      return body.success === true;
    } catch (err) {
      this.logger.error({ err: (err as Error).message }, 'turnstile unreachable');
      return false;
    }
  }
}

/** Test double: accepts "pass", rejects everything else. */
export class FakeTurnstile implements TurnstileVerifier {
  async verify(token: string): Promise<boolean> {
    return token === 'pass';
  }
}
