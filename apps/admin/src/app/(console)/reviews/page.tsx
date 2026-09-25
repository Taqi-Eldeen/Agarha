'use client';
import { Button, EmptyState, ReviewItem } from '@agarha/ui-web';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

type R = { id: string; rating: number; body: string | null; createdAt: string };

export default function Reviews() {
  const { t } = useT();
  const invalidate = useInvalidate();
  const q = useAdminQuery<{ items: R[] }>(['reviews'], '/admin/reviews');
  const moderate = async (id: string, approve: boolean) => {
    await adminFetch(`/admin/reviews/${id}/moderate`, { method: 'POST', json: { approve } });
    await invalidate(['reviews']);
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('reviews.title')}</h1>
      {q.isSuccess && !q.data.items.length ? <EmptyState body={t('reviews.empty')} /> : null}
      {q.data?.items.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-card px-4">
          <ReviewItem rating={r.rating} body={r.body} date={r.createdAt} reply={null} />
          <div className="flex gap-2 pb-3">
            <Button size="sm" onClick={() => void moderate(r.id, true)}>{t('reviews.approve')}</Button>
            <Button size="sm" variant="danger" onClick={() => void moderate(r.id, false)}>{t('reviews.reject')}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
