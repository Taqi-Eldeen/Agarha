import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env';
import { hmac } from '../common/crypto';

/**
 * Structured JSON logs with requestId, hashed user id and module; PII and tokens redacted.
 * Phone numbers, OTP codes, passwords, cookies and auth headers never reach the log sink.
 */
export function loggerParams(env: Env): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage) => {
        const h = req.headers['x-request-id'];
        return typeof h === 'string' && /^[\w-]{8,64}$/.test(h) ? h : randomUUID();
      },
      customProps: (req: IncomingMessage) => {
        const r = req as IncomingMessage & {
          auth?: { userId: string; scope: string };
          route?: { path?: string };
        };
        const path = (r.url ?? '').split('?')[0] ?? '';
        return {
          module: path.split('/')[2] ?? 'root',
          ...(r.auth
            ? {
                userHash: hmac(env.HASH_PEPPER, `user:${r.auth.userId}`).slice(0, 16),
                scope: r.auth.scope,
              }
            : {}),
        };
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          '*.phone',
          '*.phoneE164',
          '*.password',
          '*.code',
          '*.otp',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
          '*.idToken',
          '*.turnstileToken',
          'req.query.sig',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url.replace(/([?&](sig|hmac|token)=)[^&]+/g, '$1[redacted]'),
        }),
      },
      ...(env.APP_ENV === 'local' && env.NODE_ENV === 'development' && hasPrettyPrinter()
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
      autoLogging: { ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/v1/health') },
    },
  };
}

/** pino-pretty is a dev dependency: production images don't ship it, so never ask pino for it there. */
function hasPrettyPrinter(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}
