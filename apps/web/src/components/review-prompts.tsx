'use client';
import { useApi } from '@agarha/api-client';
import { Button, RatingStars, TextField, useToast } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { track } from '@/lib/analytics';

type Reviewable = { leadId: string; dealerId: string; listingId: string; createdAt: string };

/** Lead-gated reviews (Q7): only enquiries older than 24h from this account appear here. */
export function ReviewPrompts() {
  const t = useTranslations('web.review');
  const api = useApi();
  const toast = useToast();
  const q = useQuery({ queryKey: ['reviewable'], queryFn: async () => (await api.GET('/v1/me/reviewable')).data as unknown as { items: Reviewable[] } });
  const [state, setState] = useState<Record<string, { rating: number; body: string }>>({});
  if (!q.data?.items.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-h2">{t('pending')}</h2>
      {q.data.items.slice(0, 5).map((r) => {
        const s = state[r.leadId] ?? { rating: 0, body: '' };
        return (
          <form
            key={r.leadId}
            className="flex flex-col gap-2 border-b border-border pb-3 last:border-0"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.POST('/v1/reviews', { body: { leadId: r.leadId, rating: s.rating, ...(s.body ? { body: s.body } : {}) } });
              track('review_submitted', { rating: s.rating });
              toast({ tone: 'success', text: t('thanks') });
              await q.refetch();
            }}
          >
            <RatingStars value={s.rating} onChange={(rating) => setState({ ...state, [r.leadId]: { ...s, rating } })} />
            <TextField label={t('body')} value={s.body} onChange={(e) => setState({ ...state, [r.leadId]: { ...s, body: e.target.value } })} maxLength={1000} />
            <Button type="submit" size="sm" className="self-start" disabled={!s.rating}>
              {t('submit')}
            </Button>
          </form>
        );
      })}
    </section>
  );
}
