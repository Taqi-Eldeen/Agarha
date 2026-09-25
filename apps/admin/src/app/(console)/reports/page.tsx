'use client';
import { messages } from '@agarha/i18n';
import { Button, EmptyState, TextField, useToast } from '@agarha/ui-web';
import { useState } from 'react';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Report = { id: string; listingId: string | null; dealerId: string; reason: keyof (typeof messages)['en']['web']['report']['reasons']; details: string | null; createdAt: string };

export default function Reports() {
  const { t, locale } = useT();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [note, setNote] = useState<Record<string, string>>({});
  const q = useAdminQuery<{ items: Report[] }>(['reports'], '/admin/reports');
  const resolve = async (id: string, action: 'dismiss' | 'hide_listing' | 'suspend_dealer') => {
    try {
      await adminFetch(`/admin/reports/${id}/resolve`, { method: 'POST', json: { action, note: note[id] ?? '' } });
      await invalidate(['reports']);
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('reports.title')}</h1>
      {q.isSuccess && !q.data.items.length ? <EmptyState body={t('reports.empty')} /> : null}
      <ul className="flex flex-col gap-3">
        {q.data?.items.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <p className="font-semibold">{messages[locale].web.report.reasons[r.reason]}</p>
            {r.details ? <p>{r.details}</p> : null}
            <p dir="ltr" className="text-caption text-fg-secondary">{r.listingId} · {new Date(r.createdAt).toISOString()}</p>
            <TextField label={t('reports.note')} value={note[r.id] ?? ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={(note[r.id] ?? '').length < 3} onClick={() => void resolve(r.id, 'dismiss')}>{t('reports.dismiss')}</Button>
              <Button size="sm" variant="danger" disabled={(note[r.id] ?? '').length < 3 || !r.listingId} onClick={() => void resolve(r.id, 'hide_listing')}>{t('reports.hideListing')}</Button>
              <Button size="sm" variant="danger" disabled={(note[r.id] ?? '').length < 3} onClick={() => void resolve(r.id, 'suspend_dealer')}>{t('reports.suspendDealer')}</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
