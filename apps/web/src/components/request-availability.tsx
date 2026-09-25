'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { Button, Drawer, TextField, useToast } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Phase 6: ask the dealer whether the car is free for specific dates (no booking, no payment). */
export function AvailabilityDrawer({ listingId, open, setOpen }: { listingId: string; open: boolean; setOpen: (o: boolean) => void }) {
  const t = useTranslations('web.listing');
  const tu = useTranslations('ui');
  const api = useApi();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [note, setNote] = useState('');
  return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={t('requestAvailability')}
        footer={
          <Button
            block
            onClick={async () => {
              try {
                await api.POST('/v1/availability-requests', { body: { listingId, startDate: start, endDate: end, ...(note ? { note } : {}) } as never });
                toast({ tone: 'success', text: t('availabilitySent') });
                setOpen(false);
              } catch (e) {
                toast({ tone: 'danger', text: (e as ApiRequestError).message });
              }
            }}
          >
            {tu('confirm')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-caption text-fg-secondary">{t('availabilityHint')}</p>
          <TextField label={t('availabilityFrom')} type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} dir="ltr" />
          <TextField label={t('availabilityTo')} type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr" />
          <TextField label={t('availabilityNote')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>
      </Drawer>
  );
}
