import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** Crash + performance reporting. No DSN (local, tests) = disabled; PII never sent. */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

export const wrapRoot = (C: () => React.JSX.Element | null) => (dsn ? Sentry.wrap(C) : C);
