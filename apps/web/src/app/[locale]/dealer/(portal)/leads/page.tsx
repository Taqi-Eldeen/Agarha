'use client';
import { useApi } from '@agarha/api-client';
import { formatDate } from '@agarha/i18n';
import { DataTable, EmptyState, Select, TextField, useToast } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Lead = { id: string; refCode: string; channel: 'whatsapp' | 'call'; outcome: string; createdAt: string; signedIn: boolean; listing: { nameAr: string; nameEn: string; year: number } | null };
/** Lead reference codes look like AG-7K2Q. */
const REF_PREFIX = 'AG-';
const OUTCOMES = ['unknown', 'from_agarha', 'rented', 'not_rented', 'no_reply'] as const;

export default function Leads() {
  const t = useTranslations('dealer.leads');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [ref, setRef] = useState('');
  const q = useQuery({ queryKey: ['leads'], queryFn: async () => (await api.GET('/v1/dealer/leads', { params: { query: { limit: 100 } } })).data as unknown as { items: Lead[] } });
  const rows = (q.data?.items ?? []).filter((l) => !ref || l.refCode.includes(ref.toUpperCase()));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      <TextField label={t('findRef')} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={REF_PREFIX} dir="ltr" />
      <DataTable
        caption={t('title')}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState body={t('empty')} />}
        columns={[
          { key: 'ref', header: t('ref'), cell: (r) => <span dir="ltr" className="font-mono">{r.refCode}</span> },
          { key: 'car', header: t('car'), cell: (r) => (r.listing ? `${locale === 'ar' ? r.listing.nameAr : r.listing.nameEn} ${r.listing.year}` : '—') },
          { key: 'channel', header: t('channel'), cell: (r) => `${r.channel === 'whatsapp' ? t('whatsapp') : t('call')}${r.signedIn ? ` · ${t('signedIn')}` : ''}` },
          { key: 'time', header: t('time'), cell: (r) => formatDate(new Date(r.createdAt), locale, { dateStyle: 'medium', timeStyle: 'short' }), sortValue: (r) => r.createdAt },
          {
            key: 'outcome',
            header: t('outcome'),
            cell: (r) => (
              <Select
                label={t('outcome')}
                value={r.outcome}
                onValueChange={async (v) => {
                  if (v === 'unknown') return;
                  await api.PUT('/v1/dealer/leads/{id}/outcome', { params: { path: { id: r.id } }, body: { outcome: v as 'rented' } });
                  toast({ tone: 'success', text: t(`outcomes.${v as 'rented'}`) });
                  await qc.invalidateQueries({ queryKey: ['leads'] });
                }}
                options={OUTCOMES.map((o) => ({ value: o, label: t(`outcomes.${o}`) }))}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
