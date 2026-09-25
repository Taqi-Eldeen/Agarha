import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');
const csv = z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

/** Cloudflare's documented always-pass test secret. Rejected in production below. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'preview', 'staging', 'production']).default('local'),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
    REDIS_URL: z.url(),

    /** Browser origins allowed to call the API with cookies. */
    CORS_ORIGINS: csv.default(['http://localhost:3000']),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: bool.default(true),
    /** Number of reverse proxies (Cloudflare + load balancer) in front of the API, for req.ip. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default('agarha-api'),
    /** HMAC key for OTP codes, IPs and other values we only need to compare, never read back. */
    HASH_PEPPER: z.string().min(32),

    TURNSTILE_SECRET_KEY: z.string().min(1),

    OTP_TTL_SECONDS: z.coerce.number().int().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().default(5),
    OTP_RESEND_AFTER_SECONDS: z.coerce.number().int().default(60),
    /** Ordered failover list for SMS OTP. `console` logs the code and is local/test only. */
    SMS_PROVIDERS: csv.pipe(z.array(z.enum(['twilio', 'vonage', 'console'])).min(1)).default(['console']),
    WHATSAPP_OTP_ENABLED: bool.default(false),

    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    VONAGE_API_KEY: z.string().optional(),
    VONAGE_API_SECRET: z.string().optional(),
    VONAGE_FROM: z.string().default('Agarha'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_OTP_TEMPLATE: z.string().default('agarha_otp'),
    WHATSAPP_GRAPH_VERSION: z.string().default('v21.0'),
  })
  .superRefine((env, ctx) => {
    const need = (cond: boolean, keys: (keyof typeof env)[], why: string) => {
      if (!cond) return;
      for (const k of keys)
        if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `required when ${why}` });
    };
    need(env.SMS_PROVIDERS.includes('twilio'), ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID'], 'SMS_PROVIDERS includes twilio');
    need(env.SMS_PROVIDERS.includes('vonage'), ['VONAGE_API_KEY', 'VONAGE_API_SECRET'], 'SMS_PROVIDERS includes vonage');
    need(env.WHATSAPP_OTP_ENABLED, ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'], 'WHATSAPP_OTP_ENABLED');

    if (env.APP_ENV === 'production') {
      if (env.SMS_PROVIDERS.includes('console'))
        ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDERS'], message: 'console provider is not allowed in production' });
      if (env.SMS_PROVIDERS.length < 2)
        ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDERS'], message: 'production needs two SMS providers for failover' });
      if (env.TURNSTILE_SECRET_KEY === TURNSTILE_TEST_SECRET)
        ctx.addIssue({ code: 'custom', path: ['TURNSTILE_SECRET_KEY'], message: 'test secret is not allowed in production' });
      if (!env.COOKIE_SECURE)
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'must be true in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates process.env at boot. Fails fast with every problem listed, never printing values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const ENV = Symbol('ENV');
