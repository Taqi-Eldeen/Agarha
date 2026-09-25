'use client';
import { ApiRequestError, useApi } from '@agarha/api-client';
import { availabilityRequestInputSchema } from '@agarha/schemas';
import { Button, Drawer, TextField, useToast } from '@agarha/ui-web';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { track } from '@/lib/analytics';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';

type AvailabilityForm = { startDate: string; endDate: string; note: string };

/** Cairo calendar date for today (the API compares against Cairo, not UTC). */
const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

/** Phase 6: ask the dealer whether the car is free for specific dates (no booking, no payment). */
export function AvailabilityDrawer({
  listingId,
  open,
  setOpen,
}: {
  listingId: string;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const t = useTranslations('web.listing');
  const tu = useTranslations('ui');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const toast = useToast();
  const { text, known } = useFieldError();
  const today = cairoToday();
  const toInput = (v: AvailabilityForm) => ({
    listingId,
    startDate: v.startDate,
    endDate: v.endDate,
    locale,
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
  });
  const form = useForm<AvailabilityForm>({
    defaultValues: { startDate: today, endDate: today, note: '' },
    resolver: schemaResolver(availabilityRequestInputSchema, toInput, known),
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await api.POST('/v1/availability-requests', { body: toInput(v) as never });
      track('availability_requested', { listing_id: listingId });
      toast({ tone: 'success', text: t('availabilitySent') });
      setOpen(false);
    } catch (e) {
      if (!applyServerErrors(form, e))
        toast({
          tone: 'danger',
          text: text(e instanceof ApiRequestError ? e.code : 'internal_error') ?? '',
        });
    }
  });
  const err = (k: keyof AvailabilityForm) => text(form.formState.errors[k]?.message);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('requestAvailability')}
      footer={
        <Button block loading={form.formState.isSubmitting} onClick={() => void submit()}>
          {tu('confirm')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption text-fg-secondary">{t('availabilityHint')}</p>
        <TextField
          label={t('availabilityFrom')}
          type="date"
          min={today}
          {...form.register('startDate')}
          error={err('startDate')}
          dir="ltr"
        />
        <TextField
          label={t('availabilityTo')}
          type="date"
          min={form.watch('startDate')}
          {...form.register('endDate')}
          error={err('endDate')}
          dir="ltr"
        />
        <TextField
          label={t('availabilityNote')}
          {...form.register('note')}
          error={err('note')}
          maxLength={300}
        />
      </div>
    </Drawer>
  );
}
