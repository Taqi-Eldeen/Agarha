// Schedules (section 6). Cron times are Africa/Cairo.
export const SCHEDULES = [
  {
    job: 'freshness',
    pattern: '5 * * * *',
    description: 'Hourly: auto-hide listings unconfirmed for 14 days',
  },
  {
    job: 'availability_nudges',
    pattern: '0 10 * * 6',
    description: 'Weekly (Saturday 10:00): "still available?" dealer nudges',
  },
  {
    job: 'saved_search_matching',
    pattern: '*/30 9-21 * * *',
    description: 'Every 30 min in the daytime: saved-search alerts',
  },
  {
    job: 'sitemap',
    pattern: '15 3 * * *',
    description: 'Daily: sitemap rebuild + full search reindex',
  },
  {
    job: 'retention',
    pattern: '30 3 * * *',
    description:
      'Daily: retention (leads, reports, audit 24 months; rejected docs, deliveries 90 days; OTPs 1 day; expired sessions)',
  },
  {
    job: 'subscription_renewals',
    pattern: '0 8 * * *',
    description: 'Daily: subscription renewals and downgrades',
  },
  {
    job: 'otp_synthetic',
    pattern: '20 * * * *',
    description: 'Hourly: synthetic OTP send + verify to SYNTHETIC_OTP_PHONE (uptime check)',
  },
  {
    job: 'featured_expiry',
    pattern: '10 * * * *',
    description: 'Hourly: expire availability requests, refresh featured flags',
  },
] as const;
