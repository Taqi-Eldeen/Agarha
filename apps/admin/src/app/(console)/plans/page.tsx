'use client';
import { formatEgp } from '@agarha/i18n';
import type { Plan } from '@agarha/schemas';
import { Button, DataTable, TextField, useToast } from '@agarha/ui-web';
import { useState } from 'react';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Invoice = { id: string; number: string; dealerId: string; status: string; totalEgp: number; createdAt: string };

export default function Plans() {
  const { t, locale } = useT();
  const toast = useToast();
  const invalidate = useInvalidate();
  const plans = useAdminQuery<{ items: Plan[] }>(['plans'], '/admin/plans');
  const invoices = useAdminQuery<{ items: Invoice[] }>(['invoices'], '/admin/invoices');
  const [edit, setEdit] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">{t('plans.title')}</h1>
      <ul className="grid gap-3 md:grid-cols-3">
        {plans.data?.items.map((p) => (
          <li key={p.code} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">{locale === 'ar' ? p.nameAr : p.nameEn}</p>
            <TextField label={t('plans.price')} inputMode="numeric" dir="ltr" defaultValue={String(p.priceMonthlyEgp)} onChange={(e) => setEdit({ ...edit, [p.code]: e.target.value })} />
            <p className="text-caption text-fg-secondary">{t('plans.live')}: {p.maxLiveListings ?? '∞'} · {t('plans.team')}: {p.maxTeamMembers} · {t('plans.credits')}: {p.featuredCreditsPerMonth}</p>
            <Button
              size="sm"
              className="self-start"
              onClick={async () => {
                try {
                  await adminFetch(`/admin/plans/${p.code}`, { method: 'PUT', json: { ...p, priceMonthlyEgp: Number(edit[p.code] ?? p.priceMonthlyEgp) } });
                  toast({ tone: 'success', text: t('common.saved') });
                  await invalidate(['plans']);
                } catch (e) {
                  toast({ tone: 'danger', text: (e as Error).message });
                }
              }}
            >
              {t('catalog.save')}
            </Button>
          </li>
        ))}
      </ul>
      <h2 className="text-h2">{t('plans.invoices')}</h2>
      <DataTable
        caption={t('plans.invoices')}
        rows={invoices.data?.items ?? []}
        rowKey={(i) => i.id}
        columns={[
          { key: 'n', header: t('plans.invoices'), cell: (i) => <span dir="ltr">{i.number}</span> },
          { key: 's', header: t('dealers.status'), cell: (i) => i.status },
          { key: 'a', header: t('plans.price'), cell: (i) => formatEgp(i.totalEgp, locale), numeric: true, sortValue: (i) => i.totalEgp },
          { key: 'd', header: t('audit.time'), cell: (i) => i.createdAt.slice(0, 10), sortValue: (i) => i.createdAt },
        ]}
      />
    </div>
  );
}
