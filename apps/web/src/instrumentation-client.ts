// Sentry is loaded only when a DSN is configured, and lazily, so it never weighs on first load.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import('@sentry/nextjs').then((Sentry) =>
    Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local', tracesSampleRate: 0.1, sendDefaultPii: false, replaysSessionSampleRate: 0 }),
  );
}
