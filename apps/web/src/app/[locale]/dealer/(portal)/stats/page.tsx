'use client';
import { useApi } from '@agarha/api-client';
import { formatNumber } from '@agarha/i18n';
import type { DealerStats } from '@agarha/schemas';
import { ChipGroup, DataTable, ErrorState, InlineAlert, StatTile } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

export default function Stats() {
  const t = useTranslations('dealer.stats');
  const tu = useTranslations('ui');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const [days, setDays] = useState('30');
  const q = useQuery({ queryKey: ['stats', days], queryFn: async () => (await api.GET('/v1/dealer/stats', { params: { query: { days: Number(days) } } })).data as DealerStats });
  const s = q.data;
  const n = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '—' : `${formatNumber(v, locale)}${suffix}`);
  const max = Math.max(1, ...(s?.daily.map((d) => d.views) ?? [1]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      <ChipGroup label={t('period', { days })} single value={[days]} onChange={(v) => v[0] && setDays(v[0])} options={['7', '30', '90'].map((d) => ({ value: d, label: t('period', { days: d }) }))} />
      {q.isError ? <ErrorState body={tu('errorTitle')} onRetry={() => void q.refetch()} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('views')} value={n(s?.totals.views)} />
        <StatTile label={t('contacts')} value={n((s?.totals.whatsapp ?? 0) + (s?.totals.calls ?? 0))} />
        <StatTile label={t('conversion')} value={n(s?.totals.conversion, '%')} />
        <StatTile label={t('freshness')} value={n(s?.freshnessScore, '%')} />
      </div>
      <InlineAlert tone="info">{t('freshnessHint')}</InlineAlert>
      {s?.daily.length ? (
        <figure aria-label={t('views')} className="flex h-32 items-end gap-1 rounded-lg border border-border bg-card p-3" dir="ltr">
          {s.daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.views} / ${d.contacts}`} className="flex-1 rounded-t bg-brand/70" style={{ height: `${(d.views / max) * 100}%` }} />
          ))}
        </figure>
      ) : null}
      <h2 className="text-h2">{t('perCar')}</h2>
      <DataTable
        caption={t('perCar')}
        rows={s?.cars ?? []}
        rowKey={(r) => r.listingId}
        columns={[
          { key: 'car', header: t('perCar'), cell: (r) => `${locale === 'ar' ? r.nameAr : r.nameEn} ${r.year}` },
          { key: 'views', header: t('views'), cell: (r) => n(r.views), sortValue: (r) => r.views, numeric: true },
          { key: 'contacts', header: t('contacts'), cell: (r) => n(r.whatsapp + r.calls), sortValue: (r) => r.whatsapp + r.calls, numeric: true },
          { key: 'conv', header: t('conversion'), cell: (r) => n(r.conversion, '%'), sortValue: (r) => r.conversion ?? -1, numeric: true },
          { key: 'fresh', header: t('freshness'), cell: (r) => n(r.freshnessScore, '%'), sortValue: (r) => r.freshnessScore, numeric: true },
        ]}
      />
    </div>
  );
}
