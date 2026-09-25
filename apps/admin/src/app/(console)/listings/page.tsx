'use client';
import { Button, ChipGroup, EmptyState, PriceTag, TextField, useToast } from '@agarha/ui-web';
import type { Listing } from '@agarha/schemas';
import { useState } from 'react';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function Listings() {
  const { t } = useT();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [queue, setQueue] = useState('pending');
  const [reason, setReason] = useState<Record<string, string>>({});
  const q = useAdminQuery<{ items: Listing[] }>(
    ['listings', queue],
    `/admin/listings?queue=${queue}`,
  );
  const moderate = async (id: string, decision: 'approve' | 'reject' | 'hide') => {
    try {
      await adminFetch(`/admin/listings/${id}/moderate`, {
        method: 'POST',
        json: decision === 'approve' ? { decision } : { decision, reason: reason[id] ?? '' },
      });
      await invalidate(['listings', queue]);
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('nav.listings')}</h1>
      <ChipGroup
        label={t('nav.listings')}
        single
        value={[queue]}
        onChange={(v) => setQueue(v[0] ?? 'pending')}
        options={[
          { value: 'pending', label: t('listings.pending') },
          { value: 'unreviewed', label: t('listings.unreviewed') },
          { value: 'hidden', label: t('listings.hidden') },
        ]}
      />
      {q.isSuccess && !q.data.items.length ? <EmptyState body={t('listings.empty')} /> : null}
      <ul className="flex flex-col gap-3">
        {q.data?.items.map((l) => (
          <li
            key={l.id}
            className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[8rem_1fr_auto]"
          >
            <div className="flex gap-1 overflow-x-auto">
              {l.photos
                .slice(0, 3)
                .map((p) =>
                  p.urls ? (
                    <img
                      key={p.id}
                      src={p.urls.webp?.['320']}
                      alt=""
                      className="h-20 rounded object-cover"
                    />
                  ) : null,
                )}
            </div>
            <div className="flex flex-col gap-1">
              <p
                className="font-semibold"
                dir="ltr"
              >{`${l.year} · ${l.color} · ${l.transmission} · ${l.seats}`}</p>
              <PriceTag prices={l.prices} showDeposit />
              <p className="text-caption text-fg-secondary">{`${l.requiredDocs.join(', ')} · ${l.minAge}+ · ${t('listings.km', { value: l.kmLimitPerDay ?? '∞' })}`}</p>
              {l.hiddenReason ? <p className="text-caption text-stale">{l.hiddenReason}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => void moderate(l.id, 'approve')}>
                {t('listings.approve')}
              </Button>
              <TextField
                label={t('dealers.reason')}
                value={reason[l.id] ?? ''}
                onChange={(e) => setReason({ ...reason, [l.id]: e.target.value })}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={(reason[l.id] ?? '').length < 3}
                  onClick={() => void moderate(l.id, 'reject')}
                >
                  {t('listings.reject')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={(reason[l.id] ?? '').length < 3}
                  onClick={() => void moderate(l.id, 'hide')}
                >
                  {t('listings.hide')}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
