'use client';
import { Badge, ChipGroup, DataTable, EmptyState, TextField } from '@agarha/ui-web';
import Link from 'next/link';
import { useState } from 'react';
import { useAdminQuery } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Dealer = { id: string; slug: string; displayNameAr: string; displayNameEn: string; legalName: string; status: string; suspendedAt: string | null; updatedAt: string; phoneE164: string };

export default function Dealers() {
  const { t, locale } = useT();
  const [status, setStatus] = useState('pending_review');
  const [q, setQ] = useState('');
  const qs = new URLSearchParams({ ...(status !== 'all' ? { status } : {}), ...(q ? { q } : {}) });
  const list = useAdminQuery<{ items: Dealer[] }>(['dealers', status, q], `/admin/dealers?${qs}`);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('nav.dealers')}</h1>
      <ChipGroup label={t('dealers.status')} single value={[status]} onChange={(v) => setStatus(v[0] ?? 'all')} options={[{ value: 'pending_review', label: t('dealers.queue') }, { value: 'all', label: t('dealers.all') }, { value: 'verified', label: t('dealers.statuses.verified') }, { value: 'onboarding', label: t('dealers.statuses.onboarding') }, { value: 'rejected', label: t('dealers.statuses.rejected') }, { value: 'suspended', label: t('dealers.suspendedBadge') }]} />
      <TextField label={t('dealers.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable
        caption={t('nav.dealers')}
        rows={list.data?.items ?? []}
        rowKey={(d) => d.id}
        empty={<EmptyState body={t('common.empty')} />}
        columns={[
          { key: 'name', header: t('catalog.nameEn'), cell: (d) => <Link href={`/dealers/${d.id}`} className="font-semibold text-brand hover:underline">{locale === 'ar' ? d.displayNameAr : d.displayNameEn}</Link> },
          { key: 'legal', header: t('catalog.nameAr'), cell: (d) => d.legalName },
          { key: 'status', header: t('dealers.status'), cell: (d) => (d.suspendedAt ? <Badge kind="stale">{t('dealers.suspendedBadge')}</Badge> : t(`dealers.statuses.${d.status as 'verified'}`)) },
          { key: 'updated', header: t('audit.time'), cell: (d) => new Date(d.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'), sortValue: (d) => d.updatedAt },
        ]}
      />
    </div>
  );
}
