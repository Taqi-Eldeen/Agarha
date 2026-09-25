'use client';
import { env } from './env';

import type { PostHog } from 'posthog-js';
let ph: PostHog | null = null;
const queue: [string, Record<string, unknown>][] = [];

/** Product analytics (PostHog), loaded lazily after first paint. No PII: never phone numbers or names. */
export function startAnalytics() {
  if (ph || !env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === 'undefined') return;
  const load = () =>
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY!, { api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com', capture_pageview: true, persistence: 'localStorage+cookie', disable_session_recording: true, mask_all_text: true });
      ph = posthog;
      for (const [e, p] of queue.splice(0)) posthog.capture(e, p);
    });
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 2000);
}

export type AnalyticsEvent =
  | 'search_performed'
  | 'filters_applied'
  | 'listing_viewed'
  | 'contact_clicked'
  | 'lead_created'
  | 'favorite_added'
  | 'favorite_removed'
  | 'saved_search_created'
  | 'report_submitted'
  | 'availability_requested'
  | 'review_submitted'
  | 'sign_in_started'
  | 'sign_in_completed'
  | 'dealer_signup_started'
  | 'dealer_car_added'
  | 'dealer_confirm_all'
  | 'dealer_availability_toggled';

export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean | undefined> = {}) {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (process.env.NODE_ENV === 'development') console.debug('[analytics]', event, props);
    return;
  }
  if (ph) ph.capture(event, props);
  else queue.push([event, props]);
}
