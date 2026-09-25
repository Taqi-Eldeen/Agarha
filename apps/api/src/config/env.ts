import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');
const csv = z.string().transform((s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
);

/** Cloudflare's documented always-pass test secret. Rejected in production below. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

/** Placeholder secrets from apps/api/.env.example (published in the repo, local use only). */
export const DEV_PLACEHOLDER_SECRETS = new Set([
  'local-dev-only-jwt-secret-change-me-0000000000',
  'local-dev-only-hash-pepper-change-me-000000000',
  'bG9jYWwtZGV2LW9ubHktdG90cC1rZXktMzJieXRlcyE=',
]);

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
    /** Ops-owned Egyptian mobile (E.164) for the hourly synthetic OTP check. Empty = check disabled. */
    SYNTHETIC_OTP_PHONE: z
      .union([z.literal(''), z.string().regex(/^\+201[0125]\d{8}$/, 'Egyptian mobile in E.164')])
      .optional(),
    /** Ordered failover list for SMS OTP. `console` logs the code and is local/test only. */
    SMS_PROVIDERS: csv
      .pipe(z.array(z.enum(['twilio', 'vonage', 'console'])).min(1))
      .default(['console']),
    /** WhatsApp as the OTP fallback channel (uses WHATSAPP_PROVIDER). */
    WHATSAPP_OTP_ENABLED: bool.default(true),

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
    /** Meta app secret, for X-Hub-Signature-256 on WhatsApp status webhooks. */
    WHATSAPP_APP_SECRET: z.string().optional(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    /** Dealer lead alerts + nudges. `console` records messages instead of sending. */
    WHATSAPP_PROVIDER: z.enum(['meta', 'console']).default('console'),
    WHATSAPP_LEAD_TEMPLATE: z.string().default('agarha_lead_alert'),
    WHATSAPP_NUDGE_TEMPLATE: z.string().default('agarha_availability_nudge'),
    TWILIO_STATUS_WEBHOOK_URL: z.string().optional(),
    VONAGE_SIGNATURE_SECRET: z.string().optional(),

    PUSH_PROVIDER: z.enum(['expo', 'console']).default('console'),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['resend', 'console']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Agarha <no-reply@agarha.com>'),

    /** `s3` for R2/S3/MinIO; `local` = signed local-disk mock (local/test only). */
    STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('.storage'),
    /** Public base URL of this API (used for local storage URLs and webhooks). */
    API_PUBLIC_URL: z.string().default('http://localhost:4000'),
    /** S3-compatible storage (Cloudflare R2, AWS S3 or local MinIO). */
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().default('auto'),
    STORAGE_ACCESS_KEY_ID: z.string().default('minio'),
    STORAGE_SECRET_ACCESS_KEY: z.string().default('minio-secret'),
    STORAGE_FORCE_PATH_STYLE: bool.default(false),
    STORAGE_PUBLIC_BUCKET: z.string().default('public-media'),
    STORAGE_PRIVATE_BUCKET: z.string().default('private-docs'),
    /** Public CDN base for public-media, e.g. https://media.agarha.com */
    MEDIA_PUBLIC_BASE_URL: z.string().default('http://localhost:9000/public-media'),

    MAPS_PROVIDER: z.enum(['google', 'mapbox', 'mock']).default('mock'),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    MAPBOX_ACCESS_TOKEN: z.string().optional(),

    PAYMENT_GATEWAY: z.enum(['paymob', 'mock']).default('mock'),
    PAYMOB_SECRET_KEY: z.string().optional(),
    PAYMOB_PUBLIC_KEY: z.string().optional(),
    PAYMOB_HMAC_SECRET: z.string().optional(),
    PAYMOB_INTEGRATION_IDS: csv.default([]),
    FEATURED_PRICE_PER_DAY_EGP: z.coerce.number().int().min(1).default(50),
    MOCK_PAYMENT_WEBHOOK_SECRET: z.string().default('mock-webhook-secret-local-only'),

    /** P6 search engine (used when the search_engine_meilisearch flag is on). */
    MEILI_HOST: z.string().optional(),
    MEILI_API_KEY: z.string().optional(),
    POSTHOG_API_KEY: z.string().optional(),
    POSTHOG_HOST: z.string().default('https://eu.i.posthog.com'),
    SENTRY_DSN: z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

    /** Social sign-in audiences (client ids). */
    GOOGLE_CLIENT_IDS: csv.default([]),
    APPLE_CLIENT_IDS: csv.default([]),
    /** Admin SSO */
    GOOGLE_WORKSPACE_DOMAIN: z.string().default('agarha.com'),
    ADMIN_GOOGLE_CLIENT_ID: z.string().optional(),
    /** CIDR list; empty = allow all (local only, refused in production). */
    ADMIN_IP_ALLOWLIST: csv.default([]),
    /** Local/test only: POST /v1/admin-auth/dev-login stands in for Google SSO. */
    ADMIN_DEV_LOGIN: bool.default(false),
    /** AES-256-GCM key (base64, 32 bytes) for TOTP secrets at rest. */
    TOTP_ENCRYPTION_KEY: z.string().min(40),
    PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),
    /** Feature flags that can be forced from env (PostHog decides otherwise). */
    FLAGS: csv.default([]),
  })
  .superRefine((env, ctx) => {
    const need = (cond: boolean, keys: (keyof typeof env)[], why: string) => {
      if (!cond) return;
      for (const k of keys)
        if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `required when ${why}` });
    };
    need(
      env.SMS_PROVIDERS.includes('twilio'),
      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID'],
      'SMS_PROVIDERS includes twilio',
    );
    need(
      env.SMS_PROVIDERS.includes('vonage'),
      ['VONAGE_API_KEY', 'VONAGE_API_SECRET'],
      'SMS_PROVIDERS includes vonage',
    );
    need(
      env.WHATSAPP_PROVIDER === 'meta',
      ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET'],
      'WHATSAPP_PROVIDER=meta',
    );
    need(env.PUSH_PROVIDER === 'expo', ['EXPO_ACCESS_TOKEN'], 'PUSH_PROVIDER=expo');
    need(env.EMAIL_PROVIDER === 'resend', ['RESEND_API_KEY'], 'EMAIL_PROVIDER=resend');
    need(env.MAPS_PROVIDER === 'google', ['GOOGLE_MAPS_API_KEY'], 'MAPS_PROVIDER=google');
    need(env.MAPS_PROVIDER === 'mapbox', ['MAPBOX_ACCESS_TOKEN'], 'MAPS_PROVIDER=mapbox');
    need(
      env.PAYMENT_GATEWAY === 'paymob',
      ['PAYMOB_SECRET_KEY', 'PAYMOB_PUBLIC_KEY', 'PAYMOB_HMAC_SECRET'],
      'PAYMENT_GATEWAY=paymob',
    );

    // The .env.example placeholders are public: refuse them anywhere but local/test.
    if (env.APP_ENV !== 'local' && env.NODE_ENV !== 'test')
      for (const k of ['JWT_SECRET', 'HASH_PEPPER', 'TOTP_ENCRYPTION_KEY'] as const)
        if (DEV_PLACEHOLDER_SECRETS.has(env[k]))
          ctx.addIssue({
            code: 'custom',
            path: [k],
            message: 'the local-development placeholder is not allowed outside local',
          });

    if (env.APP_ENV === 'production') {
      if (env.SMS_PROVIDERS.includes('console'))
        ctx.addIssue({
          code: 'custom',
          path: ['SMS_PROVIDERS'],
          message: 'console provider is not allowed in production',
        });
      if (env.SMS_PROVIDERS.length < 2)
        ctx.addIssue({
          code: 'custom',
          path: ['SMS_PROVIDERS'],
          message: 'production needs two SMS providers for failover',
        });
      if (env.TURNSTILE_SECRET_KEY === TURNSTILE_TEST_SECRET)
        ctx.addIssue({
          code: 'custom',
          path: ['TURNSTILE_SECRET_KEY'],
          message: 'test secret is not allowed in production',
        });
      if (env.ADMIN_DEV_LOGIN)
        ctx.addIssue({
          code: 'custom',
          path: ['ADMIN_DEV_LOGIN'],
          message: 'not allowed in production',
        });
      if (env.ADMIN_IP_ALLOWLIST.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['ADMIN_IP_ALLOWLIST'],
          message: 'required in production',
        });
      if (env.STORAGE_DRIVER === 'local')
        ctx.addIssue({
          code: 'custom',
          path: ['STORAGE_DRIVER'],
          message: 'local storage is not allowed in production',
        });
      for (const [k, v] of [
        ['WHATSAPP_PROVIDER', env.WHATSAPP_PROVIDER],
        ['PUSH_PROVIDER', env.PUSH_PROVIDER],
        ['EMAIL_PROVIDER', env.EMAIL_PROVIDER],
        ['PAYMENT_GATEWAY', env.PAYMENT_GATEWAY],
        ['MAPS_PROVIDER', env.MAPS_PROVIDER],
      ] as const)
        if (v === 'console' || v === 'mock')
          ctx.addIssue({
            code: 'custom',
            path: [k],
            message: 'mock adapters are not allowed in production',
          });
      if (!env.COOKIE_SECURE)
        ctx.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'must be true in production',
        });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates process.env at boot. Fails fast with every problem listed, never printing values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Preview environments share the staging secret but use their own database (DATABASE_NAME).
  if (source.DATABASE_NAME && source.DATABASE_URL) {
    if (!/^agarha(_pr_\d{1,7})?$/.test(source.DATABASE_NAME))
      throw new Error('Invalid DATABASE_NAME');
    const u = new URL(source.DATABASE_URL);
    u.pathname = `/${source.DATABASE_NAME}`;
    source = { ...source, DATABASE_URL: u.toString() };
  }
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const ENV = Symbol('ENV');
