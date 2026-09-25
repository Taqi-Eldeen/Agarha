import { env } from './env';

/** Analytics behind an interface: PostHog capture API when a key is set, otherwise a no-op. */
export interface Analytics {
  track(event: string, props?: Record<string, unknown>): void;
}

let distinctId = `anon-${Math.random().toString(36).slice(2)}`;
export const identify = (id: string | null) =>
  void (distinctId = id ?? `anon-${Math.random().toString(36).slice(2)}`);

const posthog: Analytics = {
  track(event, props) {
    void fetch(`${env.posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.posthogKey,
        event,
        distinct_id: distinctId,
        properties: { ...props, $lib: 'agarha-mobile' },
      }),
    }).catch(() => undefined);
  },
};

const noop: Analytics = { track: () => undefined };

export const analytics: Analytics = env.posthogKey ? posthog : noop;
export const track = (event: string, props?: Record<string, unknown>) =>
  analytics.track(event, props);
