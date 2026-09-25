'use client';
import { useApi } from '@agarha/api-client';
import { Button, EmptyState, RatingStars, ReviewItem, TextField } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type R = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  dealerReply: string | null;
};

export default function Reviews() {
  const t = useTranslations('dealer.reviews');
  const tu = useTranslations('ui');
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['dealer-reviews'],
    queryFn: async () =>
      (await api.GET('/v1/dealer/reviews')).data as unknown as {
        items: R[];
        summary: { count: number; average: number | null };
      },
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      {q.data?.summary.average ? (
        <p className="flex items-center gap-2">
          <RatingStars value={q.data.summary.average} />
          {tu('reviewsCount', { count: q.data.summary.count })}
        </p>
      ) : null}
      {q.isSuccess && !q.data.items.length ? <EmptyState body={t('empty')} /> : null}
      {q.data?.items.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-card px-4">
          <ReviewItem rating={r.rating} body={r.body} date={r.createdAt} reply={r.dealerReply} />
          {!r.dealerReply ? (
            <form
              className="flex items-end gap-2 pb-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await api.POST('/v1/dealer/reviews/{id}/reply', {
                  params: { path: { id: r.id } },
                  body: { text: drafts[r.id] ?? '' },
                });
                await qc.invalidateQueries({ queryKey: ['dealer-reviews'] });
              }}
            >
              <div className="flex-1">
                <TextField
                  label={t('reply')}
                  placeholder={t('replyPlaceholder')}
                  value={drafts[r.id] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={!drafts[r.id]?.trim()}>
                {t('send')}
              </Button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}
