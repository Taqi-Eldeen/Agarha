'use client';
import { useApi, useCities } from '@agarha/api-client';
import { branchInputSchema, businessSchema } from '@agarha/schemas';
import {
  Button,
  InlineAlert,
  PhoneField,
  Select,
  Stepper,
  TextField,
  useToast,
} from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { uploadDocument } from '@/components/dealer/upload';
import { useDealerMe } from '@/components/dealer/use-dealer';
import { Link } from '@/i18n/routing';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';

const REQUIRED = ['commercial_registration', 'tax_card', 'owner_national_id'] as const;

export default function Onboarding() {
  const t = useTranslations('dealer.onboarding');
  const tf = useTranslations('dealer.fleet');
  const me = useDealerMe();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['dealer-me'] });
  const steps = [t('steps.business'), t('steps.branches'), t('steps.documents'), t('steps.review')];
  const d = me.data;
  const current = !d ? 0 : !d.steps.branches ? 1 : !d.steps.documents || d.canSubmit ? 2 : 3;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-h1">{t('title')}</h1>
      <Stepper steps={steps} current={current} />
      {current === 0 ? <BusinessStep onDone={refresh} /> : null}
      {current === 1 ? <BranchStep onDone={refresh} /> : null}
      {current === 2 && d ? <DocumentsStep me={d} onDone={refresh} /> : null}
      {current === 3 && d ? (
        <div className="flex flex-col gap-4">
          {d.dealer.status === 'pending_review' ? (
            <InlineAlert tone="info">{t('reviewPending')}</InlineAlert>
          ) : null}
          {d.dealer.status === 'verified' ? (
            <InlineAlert tone="success">{t('reviewVerified')}</InlineAlert>
          ) : null}
          <Link href="/dealer/fleet/new" className="text-brand underline">
            {tf('add')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type BusinessForm = {
  legalName: string;
  displayNameAr: string;
  displayNameEn: string;
  commercialRegistrationNo: string;
  taxCardNo: string;
  phone: string;
  whatsapp: string;
  descriptionAr: string;
};
const businessInput = (v: BusinessForm) => ({
  ...v,
  descriptionAr: v.descriptionAr.trim() || undefined,
});

function BusinessStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('dealer.onboarding');
  const api = useApi();
  const { text, known } = useFieldError();
  const form = useForm<BusinessForm>({
    defaultValues: {
      legalName: '',
      displayNameAr: '',
      displayNameEn: '',
      commercialRegistrationNo: '',
      taxCardNo: '',
      phone: '',
      whatsapp: '',
      descriptionAr: '',
    },
    resolver: schemaResolver(businessSchema, businessInput, known),
  });
  const err = (k: keyof BusinessForm) => text(form.formState.errors[k]?.message);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        try {
          await api.POST('/v1/dealer/onboarding/business', {
            body: { ...businessInput(v), client: 'web' } as never,
          });
          onDone();
        } catch (e) {
          applyServerErrors(form, e);
        }
      })}
    >
      <TextField
        label={t('legalName')}
        {...form.register('legalName')}
        error={err('legalName')}
        required
      />
      <TextField
        label={t('displayNameAr')}
        {...form.register('displayNameAr')}
        error={err('displayNameAr')}
        required
        lang="ar"
        dir="rtl"
      />
      <TextField
        label={t('displayNameEn')}
        {...form.register('displayNameEn')}
        error={err('displayNameEn')}
        required
        lang="en"
        dir="ltr"
      />
      <TextField
        label={t('cr')}
        {...form.register('commercialRegistrationNo')}
        error={err('commercialRegistrationNo')}
        required
        inputMode="numeric"
        dir="ltr"
      />
      <TextField
        label={t('taxCard')}
        {...form.register('taxCardNo')}
        error={err('taxCardNo')}
        required
        inputMode="numeric"
        dir="ltr"
      />
      <PhoneField label={t('businessPhone')} {...form.register('phone')} error={err('phone')} />
      <PhoneField label={t('whatsapp')} {...form.register('whatsapp')} error={err('whatsapp')} />
      <TextField
        label={t('description')}
        {...form.register('descriptionAr')}
        error={err('descriptionAr')}
        optional
      />
      <Button type="submit" loading={form.formState.isSubmitting} block>
        {t('steps.branches')}
      </Button>
    </form>
  );
}

type BranchForm = { city: string; areaId: string; nameAr: string; nameEn: string; address: string };

function BranchStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('dealer.onboarding');
  const locale = useLocale();
  const api = useApi();
  const cities = useCities();
  const { text, known } = useFieldError();
  const branchInput = (v: BranchForm) => ({
    areaId: v.areaId,
    nameAr: v.nameAr,
    nameEn: v.nameEn.trim() || v.nameAr,
    ...(locale === 'ar' ? { addressAr: v.address } : { addressEn: v.address }),
    isPrimary: true,
  });
  const form = useForm<BranchForm>({
    defaultValues: { city: '', areaId: '', nameAr: '', nameEn: '', address: '' },
    resolver: schemaResolver(branchInputSchema, branchInput, known),
  });
  const city = form.watch('city');
  const areas = useQuery({
    queryKey: ['areas', city],
    enabled: !!city,
    queryFn: async () =>
      (await api.GET('/v1/catalog/cities/{slug}', { params: { path: { slug: city } } })).data!
        .areas,
  });
  const err = (k: keyof BranchForm) => text(form.formState.errors[k]?.message);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        try {
          await api.POST('/v1/dealer/branches', { body: branchInput(v) as never });
          onDone();
        } catch (e) {
          applyServerErrors(form, e);
        }
      })}
    >
      <Controller
        control={form.control}
        name="city"
        render={({ field }) => (
          <Select
            label={t('city')}
            value={field.value || undefined}
            onValueChange={(v) => {
              field.onChange(v);
              form.setValue('areaId', '');
            }}
            options={(cities.data ?? []).map((c) => ({
              value: c.slug,
              label: locale === 'ar' ? c.nameAr : c.nameEn,
            }))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="areaId"
        render={({ field }) => (
          <Select
            label={t('area')}
            value={field.value || undefined}
            onValueChange={field.onChange}
            disabled={!areas.data}
            error={err('areaId')}
            options={(areas.data ?? []).map((a) => ({
              value: a.id,
              label: locale === 'ar' ? a.nameAr : a.nameEn,
            }))}
          />
        )}
      />
      <TextField
        label={t('branchName')}
        {...form.register('nameAr')}
        error={err('nameAr')}
        required
      />
      <TextField
        label={t('branchNameEn')}
        {...form.register('nameEn')}
        error={err('nameEn')}
        optional
        dir="ltr"
      />
      <TextField label={t('address')} hint={t('pinHint')} {...form.register('address')} required />
      <Button type="submit" loading={form.formState.isSubmitting} block>
        {t('steps.documents')}
      </Button>
    </form>
  );
}

function DocumentsStep({
  me,
  onDone,
}: {
  me: NonNullable<ReturnType<typeof useDealerMe>['data']>;
  onDone: () => void;
}) {
  const t = useTranslations('dealer.onboarding');
  const te = useTranslations('errors');
  const api = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const status = (type: string) => me.documents.items.find((i) => i.type === type);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h2">{t('docsTitle')}</h2>
      <p className="text-fg-secondary">{t('docsBody')}</p>
      {me.dealer.status === 'rejected' ? (
        <InlineAlert tone="danger">
          {t('reviewRejected', {
            reason: me.documents.items.find((i) => i.rejectionReason)?.rejectionReason ?? '',
          })}
        </InlineAlert>
      ) : null}
      <ul className="flex flex-col gap-3">
        {REQUIRED.map((type) => {
          const s = status(type);
          const state = (s?.status ?? 'missing') as
            'missing' | 'uploaded' | 'approved' | 'rejected';
          return (
            <li
              key={type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{t(`docTypes.${type}`)}</p>
                <p
                  className={
                    state === 'rejected'
                      ? 'text-caption text-danger'
                      : 'text-caption text-fg-secondary'
                  }
                >
                  {state === 'approved' ? (
                    <CheckCircle2 aria-hidden className="me-1 inline size-4 text-available" />
                  ) : null}
                  {t(`docStatus.${state}`)}
                </p>
              </div>
              <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-border px-4 hover:bg-brand-subtle">
                <FileUp aria-hidden className="size-5" strokeWidth={1.75} />
                {busy === type ? '…' : state === 'missing' ? t('upload') : t('replace')}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024)
                      return toast({ tone: 'danger', text: te('validation_failed') });
                    setBusy(type);
                    try {
                      await uploadDocument(api, type, file);
                      onDone();
                    } catch {
                      toast({ tone: 'danger', text: te('internal_error') });
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        block
        disabled={!me.canSubmit}
        onClick={async () => {
          await api.POST('/v1/dealer/onboarding/submit');
          onDone();
        }}
      >
        {t('submit')}
      </Button>
    </div>
  );
}
