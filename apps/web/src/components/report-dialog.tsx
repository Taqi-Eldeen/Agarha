'use client';
import { useApi } from '@agarha/api-client';
import { reportInputSchema, type ReportReason } from '@agarha/schemas';
import { REPORT_REASONS } from '@agarha/schemas/enums';
import { Button, Drawer, Select, TextField, useToast } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { track } from '@/lib/analytics';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';

type ReportForm = { reason: ReportReason | ''; details: string };

export function ReportDrawer({
  listingId,
  open,
  setOpen,
}: {
  listingId: string;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const t = useTranslations('web.report');
  const api = useApi();
  const toast = useToast();
  const { text, known } = useFieldError();
  const toInput = (v: ReportForm) => ({
    listingId,
    reason: v.reason || undefined,
    ...(v.details.trim() ? { details: v.details.trim() } : {}),
  });
  const form = useForm<ReportForm>({
    defaultValues: { reason: '', details: '' },
    resolver: schemaResolver(reportInputSchema, toInput, known),
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await api.POST('/v1/reports', { body: toInput(v) as never });
      track('report_submitted', { reason: v.reason });
      toast({ tone: 'success', text: t('thanks') });
      form.reset();
      setOpen(false);
    } catch (e) {
      applyServerErrors(form, e);
    }
  });
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('title')}
      footer={
        <Button
          block
          disabled={!form.watch('reason')}
          loading={form.formState.isSubmitting}
          onClick={() => void submit()}
        >
          {t('submit')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <Select
              label={t('reason')}
              value={field.value || undefined}
              onValueChange={field.onChange}
              error={text(form.formState.errors.reason?.message)}
              options={REPORT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
            />
          )}
        />
        <TextField
          label={t('details')}
          {...form.register('details')}
          error={text(form.formState.errors.details?.message)}
          maxLength={1000}
        />
      </div>
    </Drawer>
  );
}
