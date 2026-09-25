'use client';
/** Lazy Sentry capture for error boundaries (keeps the SDK out of the main bundle). */
export function reportError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
}
