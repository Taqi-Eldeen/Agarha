// Sentry + OpenTelemetry. Both are no-ops unless their env vars are set.
import * as Sentry from '@sentry/node';
import type { Env } from '../config/env';

let started = false;

export async function startObservability(env: Env, service: 'api' | 'worker'): Promise<void> {
  if (started) return;
  started = true;
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.APP_ENV,
      release: process.env.GIT_SHA,
      tracesSampleRate: env.APP_ENV === 'production' ? 0.1 : 1,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) delete event.request.headers.authorization;
        }
        return event;
      },
    });
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const sdk = new NodeSDK({
      serviceName: `agarha-${service}`,
      traceExporter: new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } }),
      ],
    });
    sdk.start();
  }
}

export function captureException(err: unknown): void {
  Sentry.captureException(err);
}
