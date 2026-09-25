'use client';
import { useApi, useCities, type ApiRequestError } from '@agarha/api-client';
import { Button, InlineAlert, PhoneField, Select, Stepper, TextField, useToast } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { uploadDocument } from '@/components/dealer/upload';
import { useDealerMe } from '@/components/dealer/use-dealer';
import { Link } from '@/i18n/routing';

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
          {d.dealer.status === 'pending_review' ? <InlineAlert tone="info">{t('reviewPending')}</InlineAlert> : null}
          {d.dealer.status === 'verified' ? <InlineAlert tone="success">{t('reviewVerified')}</InlineAlert> : null}
          <Link href="/dealer/fleet/new" className="text-brand underline">{tf('add')}</Link>
        </div>
      ) : null}
    </div>
  );
}

function BusinessStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('dealer.onboarding');
  const te = useTranslations('errors');
  const api = useApi();
  const [f, setF] = useState({ legalName: '', displayNameAr: '', displayNameEn: '', commercialRegistrationNo: '', taxCardNo: '', phone: '', whatsapp: '', descriptionAr: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }), error: errors[k]?.[0] ? (te.has(errors[k][0]) ? te(errors[k][0]) : te('validation_failed')) : undefined });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.POST('/v1/dealer/onboarding/business', { body: { ...f, descriptionAr: f.descriptionAr || undefined, client: 'web' } as never });
          onDone();
        } catch (err) {
          setErrors(((err as ApiRequestError).details as { fieldErrors?: Record<string, string[]> })?.fieldErrors ?? {});
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label={t('legalName')} {...field('legalName')} required />
      <TextField label={t('displayNameAr')} {...field('displayNameAr')} required lang="ar" dir="rtl" />
      <TextField label={t('displayNameEn')} {...field('displayNameEn')} required lang="en" dir="ltr" />
      <TextField label={t('cr')} {...field('commercialRegistrationNo')} required inputMode="numeric" dir="ltr" />
      <TextField label={t('taxCard')} {...field('taxCardNo')} required inputMode="numeric" dir="ltr" />
      <PhoneField label={t('businessPhone')} {...field('phone')} />
      <PhoneField label={t('whatsapp')} {...field('whatsapp')} />
      <TextField label={t('description')} {...field('descriptionAr')} optional />
      <Button type="submit" loading={busy} block>
        {t('steps.branches')}
      </Button>
    </form>
  );
}

function BranchStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('dealer.onboarding');
  const locale = useLocale();
  const api = useApi();
  const cities = useCities();
  const [city, setCity] = useState<string>();
  const [area, setArea] = useState<string>();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const areas = useQuery({ queryKey: ['areas', city], enabled: !!city, queryFn: async () => (await api.GET('/v1/catalog/cities/{slug}', { params: { path: { slug: city! } } })).data!.areas });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.POST('/v1/dealer/branches', { body: { areaId: area!, nameAr, nameEn: nameEn || nameAr, ...(locale === 'ar' ? { addressAr: address } : { addressEn: address }), isPrimary: true } as never });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Select label={t('city')} value={city} onValueChange={(v) => { setCity(v); setArea(undefined); }} options={(cities.data ?? []).map((c) => ({ value: c.slug, label: locale === 'ar' ? c.nameAr : c.nameEn }))} />
      <Select label={t('area')} value={area} onValueChange={setArea} disabled={!areas.data} options={(areas.data ?? []).map((a) => ({ value: a.id, label: locale === 'ar' ? a.nameAr : a.nameEn }))} />
      <TextField label={t('branchName')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
      <TextField label={t('branchNameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} optional dir="ltr" />
      <TextField label={t('address')} hint={t('pinHint')} value={address} onChange={(e) => setAddress(e.target.value)} required />
      <Button type="submit" loading={busy} disabled={!area} block>
        {t('steps.documents')}
      </Button>
    </form>
  );
}

function DocumentsStep({ me, onDone }: { me: NonNullable<ReturnType<typeof useDealerMe>['data']>; onDone: () => void }) {
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
      {me.dealer.status === 'rejected' ? <InlineAlert tone="danger">{t('reviewRejected', { reason: me.documents.items.find((i) => i.rejectionReason)?.rejectionReason ?? '' })}</InlineAlert> : null}
      <ul className="flex flex-col gap-3">
        {REQUIRED.map((type) => {
          const s = status(type);
          const state = (s?.status ?? 'missing') as 'missing' | 'uploaded' | 'approved' | 'rejected';
          return (
            <li key={type} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-medium">{t(`docTypes.${type}`)}</p>
                <p className={state === 'rejected' ? 'text-caption text-danger' : 'text-caption text-fg-secondary'}>
                  {state === 'approved' ? <CheckCircle2 aria-hidden className="me-1 inline size-4 text-available" /> : null}
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
                    if (file.size > 10 * 1024 * 1024) return toast({ tone: 'danger', text: te('validation_failed') });
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
