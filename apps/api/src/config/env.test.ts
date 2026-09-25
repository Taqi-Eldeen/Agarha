import { loadEnv } from './env';

// The API refuses to boot with unsafe production configuration (section 10: config validated at boot).
const local = {
  DATABASE_URL: 'postgres://a:b@localhost:5432/agarha',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'local-dev-only-jwt-secret-change-me-0000000000',
  HASH_PEPPER: 'local-dev-only-hash-pepper-change-me-000000000',
  TOTP_ENCRYPTION_KEY: 'bG9jYWwtZGV2LW9ubHktdG90cC1rZXktMzJieXRlcyE=',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  NODE_ENV: 'development',
  APP_ENV: 'local',
};
const strong = {
  JWT_SECRET: 'x'.repeat(48),
  HASH_PEPPER: 'y'.repeat(48),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};
const production = {
  ...local,
  ...strong,
  NODE_ENV: 'production',
  APP_ENV: 'production',
  TURNSTILE_SECRET_KEY: 'real-turnstile-secret',
  SMS_PROVIDERS: 'twilio,vonage',
  TWILIO_ACCOUNT_SID: 'AC1',
  TWILIO_AUTH_TOKEN: 't',
  TWILIO_MESSAGING_SERVICE_SID: 'MG1',
  VONAGE_API_KEY: 'k',
  VONAGE_API_SECRET: 's',
  STORAGE_DRIVER: 's3',
  COOKIE_SECURE: 'true',
  ADMIN_IP_ALLOWLIST: '198.51.100.0/24',
  ADMIN_DEV_LOGIN: 'false',
  WHATSAPP_PROVIDER: 'meta',
  WHATSAPP_PHONE_NUMBER_ID: '1',
  WHATSAPP_ACCESS_TOKEN: 't',
  WHATSAPP_APP_SECRET: 's',
  PUSH_PROVIDER: 'expo',
  EXPO_ACCESS_TOKEN: 't',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_1',
  PAYMENT_GATEWAY: 'paymob',
  PAYMOB_SECRET_KEY: 's',
  PAYMOB_PUBLIC_KEY: 'p',
  PAYMOB_HMAC_SECRET: 'h',
  MAPS_PROVIDER: 'google',
  GOOGLE_MAPS_API_KEY: 'k',
};

describe('environment validation', () => {
  it('accepts the local .env.example values locally', () => {
    expect(loadEnv(local).APP_ENV).toBe('local');
  });

  it('accepts a complete production configuration', () => {
    expect(loadEnv(production).SMS_PROVIDERS).toEqual(['twilio', 'vonage']);
  });

  it('refuses the published placeholder secrets outside local', () => {
    expect(() => loadEnv({ ...local, APP_ENV: 'staging' })).toThrow(/JWT_SECRET[\s\S]*placeholder/);
  });

  it.each([
    [
      'the Turnstile test secret',
      { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' },
      /TURNSTILE_SECRET_KEY/,
    ],
    ['the console SMS provider', { SMS_PROVIDERS: 'console' }, /SMS_PROVIDERS/],
    ['a single SMS provider', { SMS_PROVIDERS: 'twilio' }, /two SMS providers/],
    ['the admin dev login', { ADMIN_DEV_LOGIN: 'true' }, /ADMIN_DEV_LOGIN/],
    ['an empty admin IP allowlist', { ADMIN_IP_ALLOWLIST: '' }, /ADMIN_IP_ALLOWLIST/],
    ['local disk storage', { STORAGE_DRIVER: 'local' }, /STORAGE_DRIVER/],
    ['a mock payment gateway', { PAYMENT_GATEWAY: 'mock' }, /PAYMENT_GATEWAY/],
    ['insecure cookies', { COOKIE_SECURE: 'false' }, /COOKIE_SECURE/],
  ])('refuses %s in production', (_label, override, pattern) => {
    expect(() => loadEnv({ ...production, ...override })).toThrow(pattern);
  });

  it('needs provider keys for the providers it is told to use', () => {
    expect(() => loadEnv({ ...local, MAPS_PROVIDER: 'google' })).toThrow(/GOOGLE_MAPS_API_KEY/);
    expect(() => loadEnv({ ...local, PAYMENT_GATEWAY: 'paymob' })).toThrow(/PAYMOB_SECRET_KEY/);
  });
});
