'use client';
import { formatNumber } from '@agarha/i18n';
import { StatTile } from '@agarha/ui-web';
import { useAdminQuery } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Metrics = {
  listings: {
    live: number;
    confirmedWithin7Days: number;
    freshPercent: number | null;
    pending: number;
    staleHidden: number;
  };
  dealers: { pendingReview: number; verified: number };
  daily: { day: string; views: number; leads: number }[];
  otp24h: { sent: number; failed: number; failureRate: number };
  queues: Record<string, number>;
  mapsCallsThisMonth: number;
  responseRate: number | null;
};

/** Business dashboard: live listings, freshness %, leads per day, dealers, ops health (section 10). */
export default function Dashboard() {
  const { t, locale } = useT();
  const m = useAdminQuery<Metrics>(['metrics'], '/admin/metrics').data;
  const n = (v: number | null | undefined, s = '') =>
    v === null || v === undefined ? '—' : `${formatNumber(v, locale)}${s}`;
  const leadsToday = m?.daily.at(-1)?.leads;
  const max = Math.max(1, ...(m?.daily.map((d) => d.leads) ?? [1]));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">{t('nav.dashboard')}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('dashboard.live')} value={n(m?.listings.live)} />
        <StatTile
          label={t('dashboard.fresh')}
          value={n(m?.listings.freshPercent, '%')}
          hint={n(m?.listings.confirmedWithin7Days)}
        />
        <StatTile label={t('dashboard.pending')} value={n(m?.listings.pending)} />
        <StatTile label={t('dashboard.stale')} value={n(m?.listings.staleHidden)} />
        <StatTile label={t('dashboard.dealersPending')} value={n(m?.dealers.pendingReview)} />
        <StatTile label={t('dashboard.verified')} value={n(m?.dealers.verified)} />
        <StatTile label={t('dashboard.leads')} value={n(leadsToday)} />
        <StatTile
          label={t('dashboard.responseRate')}
          value={n(m?.responseRate == null ? null : Math.round(m.responseRate * 100), '%')}
        />
        <StatTile
          label={t('dashboard.otp')}
          value={n(m?.otp24h.failureRate, '%')}
          hint={`${n(m?.otp24h.sent)} / ${n(m?.otp24h.failed)}`}
        />
      </div>
      <section
        aria-label={t('dashboard.leads')}
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 className="mb-3 text-h2">{t('dashboard.leads')}</h2>
        <div className="flex h-40 items-end gap-1" dir="ltr">
          {m?.daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${(d.leads / max) * 100}%` }}
                title={`${d.day}: ${d.leads}`}
              />
              <span className="text-label text-fg-secondary">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-h2">{t('dashboard.queues')}</h2>
          <ul>
            {Object.entries(m?.queues ?? {}).map(([q, v]) => (
              <li key={q} className="flex justify-between">
                <span dir="ltr">{q}</span>
                <span className="ag-tabular">{n(v)}</span>
              </li>
            ))}
          </ul>
        </div>
        <StatTile label={t('dashboard.maps')} value={n(m?.mapsCallsThisMonth)} />
      </section>
    </div>
  );
}
