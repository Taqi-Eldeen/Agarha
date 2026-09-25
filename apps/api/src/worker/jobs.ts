// Schedules (section 6). Cron times are Africa/Cairo.
export const SCHEDULES = [
  { job: 'freshness', pattern: '5 * * * *', description: 'Hourly: auto-hide listings unconfirmed for 14 days' },
  { job: 'availability_nudges', pattern: '0 10 * * 6', description: 'Weekly (Saturday 10:00): "still available?" dealer nudges' },
  { job: 'saved_search_matching', pattern: '*/30 9-21 * * *', description: 'Every 30 min in the daytime: saved-search alerts' },
  { job: 'sitemap', pattern: '15 3 * * *', description: 'Daily: sitemap rebuild + full search reindex' },
  { job: 'retention', pattern: '30 3 * * *', description: 'Daily: retention (leads 24 months, rejected docs 90 days, deliveries 90 days)' },
  { job: 'subscription_renewals', pattern: '0 8 * * *', description: 'Daily: subscription renewals and downgrades' },
  { job: 'featured_expiry', pattern: '10 * * * *', description: 'Hourly: expire availability requests, refresh featured flags' },
] as const;
