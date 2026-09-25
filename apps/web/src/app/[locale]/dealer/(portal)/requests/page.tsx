'use client';
import { useApi } from '@agarha/api-client';
import { Button, EmptyState } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Req = { id: string; refCode: string; startDate: string; endDate: string; note: string | null; status: 'sent' | 'available' | 'unavailable' | 'expired' };

export default function Requests() {
  const t = useTranslations('dealer.requests');
  const api = useApi();
  const q = useQuery({ queryKey: ['requests'], queryFn: async () => (await api.GET('/v1/dealer/availability-requests')).data as unknown as { items: Req[] } });
  const answer = async (id: string, available: boolean) => {
    await api.POST('/v1/dealer/availability-requests/{id}/answer', { params: { path: { id } }, body: { available } });
    await q.refetch();
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      {q.isSuccess && !q.data.items.length ? <EmptyState body={t('empty')} /> : null}
      <ul className="flex flex-col gap-2">
        {q.data?.items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div>
              <p dir="ltr" className="font-mono text-caption">{r.refCode}</p>
              <p>{t('dates', { from: r.startDate, to: r.endDate })}</p>
              {r.note ? <p className="text-caption text-fg-secondary">{r.note}</p> : null}
              <p className="text-caption">{t(`statuses.${r.status}`)}</p>
            </div>
            {r.status === 'sent' ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void answer(r.id, true)}>{t('yes')}</Button>
                <Button size="sm" variant="secondary" onClick={() => void answer(r.id, false)}>{t('no')}</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
