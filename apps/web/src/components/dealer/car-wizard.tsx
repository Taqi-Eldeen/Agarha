'use client';
import { useApi } from '@agarha/api-client';
import { DELIVERY_OPTIONS, FUELS, REQUIRED_DOCS, listingFactsSchema, type DRIVER_OPTIONS, type Listing } from '@agarha/schemas';
import { Button, ChipGroup, Combobox, InlineAlert, PhotoUploader, Select, TextField, useToast, Wizard, type UploadItem } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from '@/i18n/routing';
import { track } from '@/lib/analytics';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';
import { uploadPhoto } from './upload';
import { useDealerMe } from './use-dealer';

interface Form {
  makeId?: string;
  carModelId?: string;
  branchId?: string;
  year: string;
  color: string;
  transmission: 'automatic' | 'manual';
  fuel: (typeof FUELS)[number];
  seats: string;
  driverOption: (typeof DRIVER_OPTIONS)[number];
  priceDayEgp: string;
  priceWeekEgp: string;
  priceMonthEgp: string;
  depositEgp: string;
  minAge: string;
  requiredDocs: string[];
  kmLimitPerDay: string;
  deliveryOptions: string[];
  airportPickup: boolean;
  descriptionAr: string;
}

const STEP_FIELDS: (keyof Form | 'carModelId')[][] = [
  ['carModelId', 'branchId', 'year', 'color', 'transmission', 'fuel', 'seats', 'driverOption'],
  ['priceDayEgp', 'priceWeekEgp', 'priceMonthEgp', 'depositEgp'],
  ['minAge', 'requiredDocs', 'kmLimitPerDay', 'deliveryOptions'],
  [],
];

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(/[,\s]/g, '')));

const toPayload = (f: Form) => ({
  carModelId: f.carModelId,
  branchId: f.branchId,
  year: num(f.year),
  color: f.color,
  transmission: f.transmission,
  fuel: f.fuel,
  seats: num(f.seats),
  driverOption: f.driverOption,
  priceDayEgp: num(f.priceDayEgp),
  priceWeekEgp: num(f.priceWeekEgp) ?? null,
  priceMonthEgp: num(f.priceMonthEgp) ?? null,
  depositEgp: num(f.depositEgp),
  minAge: num(f.minAge),
  requiredDocs: f.requiredDocs,
  kmLimitPerDay: num(f.kmLimitPerDay) ?? null,
  deliveryOptions: f.deliveryOptions,
  airportPickup: f.airportPickup,
  ...(f.descriptionAr ? { descriptionAr: f.descriptionAr } : {}),
});


/** Add / edit a car in four short steps. Photos upload in the background with progress and retry. */
export function CarWizard({ listing }: { listing?: Listing & { model?: { makeId: string } | null } }) {
  const t = useTranslations('dealer.wizard');
  const tu = useTranslations('ui');
  const tl = useTranslations('web.listing');
  const tf = useTranslations('dealer.fleet');
  const locale = useLocale();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const me = useDealerMe();
  const [step, setStep] = useState(0);
  const [id, setId] = useState(listing?.id);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<(UploadItem & { file?: File })[]>([]);
  const { text, known } = useFieldError();
  const defaults: Form = {
    makeId: listing?.model?.makeId,
    carModelId: listing?.carModelId,
    branchId: listing?.branchId,
    year: String(listing?.year ?? new Date().getFullYear()),
    color: listing?.color ?? '',
    transmission: listing?.transmission ?? 'automatic',
    fuel: (listing?.fuel as Form['fuel']) ?? 'petrol',
    seats: String(listing?.seats ?? 5),
    driverOption: listing?.driverOption ?? 'self',
    priceDayEgp: listing ? String(listing.prices.day) : '',
    priceWeekEgp: listing?.prices.week ? String(listing.prices.week) : '',
    priceMonthEgp: listing?.prices.month ? String(listing.prices.month) : '',
    depositEgp: listing ? String(listing.prices.deposit) : '',
    minAge: String(listing?.minAge ?? 21),
    requiredDocs: listing?.requiredDocs ?? ['national_id', 'egyptian_driving_licence'],
    kmLimitPerDay: listing?.kmLimitPerDay != null ? String(listing.kmLimitPerDay) : '',
    deliveryOptions: listing?.deliveryOptions ?? ['branch_pickup'],
    airportPickup: listing?.airportPickup ?? false,
    descriptionAr: listing?.descriptionAr ?? '',
  };
  // One shared schema (listingFactsSchema) validates this form and the API body.
  const form = useForm<Form>({ defaultValues: defaults, resolver: schemaResolver(listingFactsSchema, toPayload, known) });
  const f = form.watch();

  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await api.GET('/v1/catalog/makes')).data!.items, staleTime: 3_600_000 });
  const models = useQuery({ queryKey: ['models', f.makeId], enabled: !!f.makeId, queryFn: async () => (await api.GET('/v1/catalog/makes/{id}/models', { params: { path: { id: f.makeId! } } })).data!.items });
  const branches = useQuery({ queryKey: ['branches'], queryFn: async () => (await api.GET('/v1/dealer/branches')).data as unknown as { items: { id: string; nameAr: string; nameEn: string; isPrimary: boolean }[] } });
  useEffect(() => {
    const primary = branches.data?.items.find((b) => b.isPrimary) ?? branches.data?.items[0];
    if (!f.branchId && primary) form.setValue('branchId', primary.id);
  }, [branches.data, f.branchId, form]);
  useEffect(() => {
    if (listing?.photos) setUploads(listing.photos.filter((p) => p.status !== 'rejected').map((p) => ({ id: p.id, previewUrl: p.urls?.webp?.['320'] ?? '', status: p.status === 'ready' ? 'ready' : 'processing' })));
  }, [listing?.photos]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => form.setValue(k, v as never, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  const payload = () => toPayload(form.getValues());

  const validateStep = (s: number) => form.trigger(STEP_FIELDS[s] as (keyof Form)[]);

  const save = async () => {
    setBusy(true);
    try {
      if (id) await api.PUT('/v1/dealer/listings/{id}', { params: { path: { id } }, body: payload() as never });
      else {
        const { data } = await api.POST('/v1/dealer/listings', { body: payload() as never, headers: { 'idempotency-key': crypto.randomUUID() } });
        setId(data!.id);
        track('dealer_car_added', {});
      }
      toast({ tone: 'success', text: t('saved') });
      return true;
    } catch (e) {
      applyServerErrors(form, e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (files: File[]) => {
    if (!id) return;
    for (const file of files) {
      const tmp = `local-${crypto.randomUUID()}`;
      setUploads((u) => [...u, { id: tmp, previewUrl: URL.createObjectURL(file), status: 'uploading', progress: 0, file }]);
      try {
        const photoId = await uploadPhoto(api, id, file, (p) => setUploads((u) => u.map((x) => (x.id === tmp ? { ...x, progress: p } : x))));
        setUploads((u) => u.map((x) => (x.id === tmp ? { ...x, id: photoId, status: 'processing' } : x)));
      } catch {
        setUploads((u) => u.map((x) => (x.id === tmp ? { ...x, status: 'failed' } : x)));
      }
    }
  };

  // Poll photo processing (worker: EXIF strip, variants, blurhash).
  useEffect(() => {
    if (!id || !uploads.some((u) => u.status === 'processing')) return;
    const i = setInterval(async () => {
      const { data } = await api.GET('/v1/dealer/listings/{id}/photos', { params: { path: { id } } });
      const items = (data as unknown as { items: { id: string; status: string; urls: { webp: Record<string, string> } | null }[] }).items;
      setUploads((u) => u.map((x) => { const s = items.find((p) => p.id === x.id); return s ? { ...x, status: s.status === 'ready' ? 'ready' : s.status === 'rejected' ? 'failed' : x.status, previewUrl: s.urls?.webp['320'] ?? x.previewUrl } : x; }));
    }, 2000);
    return () => clearInterval(i);
  }, [id, uploads, api]);

  const steps = [t('steps.car'), t('steps.prices'), t('steps.rules'), t('steps.photos')];
  const isLast = step === steps.length - 1;
  const verified = me.data?.dealer.status === 'verified';
  const e = (k: keyof Form) => text(form.formState.errors[k]?.message);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-h1">{listing ? t('titleEdit') : t('titleNew')}</h1>
      <Wizard
        steps={steps}
        current={step}
        busy={busy}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        nextLabel={isLast ? t('saveAndPublish') : undefined}
        nextDisabled={isLast && !uploads.some((u) => u.status === 'ready')}
        onNext={async () => {
          if (!isLast) {
            if (!(await validateStep(step))) return;
            if (step === 2 && !(await save())) return;
            setStep(step + 1);
            return;
          }
          if (!id) return;
          try {
            const { data } = await api.POST('/v1/dealer/listings/{id}/publish', { params: { path: { id } } });
            toast({ tone: 'success', text: (data as unknown as { status: string }).status === 'pending' ? t('submitted') : t('published') });
            await qc.invalidateQueries({ queryKey: ['fleet'] });
            router.push('/dealer/fleet');
          } catch (err) {
            toast({ tone: 'danger', text: (err as Error).message });
          }
        }}
      >
        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <Combobox label={t('make')} value={f.makeId} onValueChange={(v) => { set('makeId', v); set('carModelId', undefined); }} options={(makes.data ?? []).map((m) => ({ value: m.id, label: locale === 'ar' ? m.nameAr : m.nameEn, hint: locale === 'ar' ? m.nameEn : m.nameAr }))} />
            <Combobox label={t('model')} value={f.carModelId} onValueChange={(v) => set('carModelId', v)} error={e('carModelId')} disabled={!f.makeId} options={(models.data ?? []).map((m) => ({ value: m.id, label: locale === 'ar' ? m.nameAr : m.nameEn, hint: tu(`bodyTypes.${m.bodyType}`) }))} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t('year')} inputMode="numeric" value={f.year} onChange={(ev) => set('year', ev.target.value)} error={e('year')} dir="ltr" />
              <TextField label={t('color')} value={f.color} onChange={(ev) => set('color', ev.target.value)} error={e('color')} />
            </div>
            <ChipGroup label={t('transmission')} single value={[f.transmission]} onChange={(v) => v[0] && set('transmission', v[0] as Form['transmission'])} options={[{ value: 'automatic', label: tu('automatic') }, { value: 'manual', label: tu('manual') }]} />
            <Select label={t('fuel')} value={f.fuel} onValueChange={(v) => set('fuel', v as Form['fuel'])} options={FUELS.map((x) => ({ value: x, label: tl(`fuels.${x}`) }))} />
            <TextField label={t('seats')} inputMode="numeric" value={f.seats} onChange={(ev) => set('seats', ev.target.value)} error={e('seats')} dir="ltr" />
            <Select label={t('branch')} value={f.branchId} onValueChange={(v) => set('branchId', v)} options={(branches.data?.items ?? []).map((b) => ({ value: b.id, label: locale === 'ar' ? b.nameAr : b.nameEn }))} />
            <ChipGroup label={t('driverOption')} single value={[f.driverOption]} onChange={(v) => v[0] && set('driverOption', v[0] as Form['driverOption'])} options={[{ value: 'self', label: tu('selfDrive') }, { value: 'driver', label: tu('withDriver') }, { value: 'both', label: tu('selfOrDriver') }]} />
          </div>
        ) : null}
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <TextField label={t('priceDay')} inputMode="numeric" value={f.priceDayEgp} onChange={(ev) => set('priceDayEgp', ev.target.value)} error={e('priceDayEgp')} dir="ltr" />
            <TextField label={t('priceWeek')} inputMode="numeric" value={f.priceWeekEgp} onChange={(ev) => set('priceWeekEgp', ev.target.value)} error={e('priceWeekEgp')} dir="ltr" />
            <TextField label={t('priceMonth')} inputMode="numeric" value={f.priceMonthEgp} onChange={(ev) => set('priceMonthEgp', ev.target.value)} error={e('priceMonthEgp')} dir="ltr" />
            <TextField label={t('deposit')} hint={t('depositHint')} inputMode="numeric" value={f.depositEgp} onChange={(ev) => set('depositEgp', ev.target.value)} error={e('depositEgp')} dir="ltr" />
          </div>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <TextField label={t('minAge')} inputMode="numeric" value={f.minAge} onChange={(ev) => set('minAge', ev.target.value)} error={e('minAge')} dir="ltr" />
            <div className="flex flex-col gap-2">
              <p className="font-medium">{t('docs')}</p>
              <ChipGroup label={t('docs')} value={f.requiredDocs} onChange={(v) => set('requiredDocs', v)} options={REQUIRED_DOCS.map((d) => ({ value: d, label: tu(`docs.${d}`) }))} />
              {e('requiredDocs') ? <p role="alert" className="text-caption text-danger">{e('requiredDocs')}</p> : null}
            </div>
            <TextField label={t('kmLimit')} hint={t('kmUnlimited')} inputMode="numeric" value={f.kmLimitPerDay} onChange={(ev) => set('kmLimitPerDay', ev.target.value)} error={e('kmLimitPerDay')} dir="ltr" />
            <div className="flex flex-col gap-2">
              <p className="font-medium">{t('delivery')}</p>
              <ChipGroup label={t('delivery')} value={f.deliveryOptions} onChange={(v) => set('deliveryOptions', v)} options={DELIVERY_OPTIONS.map((d) => ({ value: d, label: tl(`deliveryOptions.${d}`) }))} />
            </div>
            <label className="flex min-h-touch items-center gap-3">
              <input type="checkbox" className="size-5" checked={f.airportPickup} onChange={(ev) => set('airportPickup', ev.target.checked)} />
              {t('airport')}
            </label>
            <TextField label={t('description')} value={f.descriptionAr} onChange={(ev) => set('descriptionAr', ev.target.value)} optional />
          </div>
        ) : null}
        {step === 3 ? (
          <div className="flex flex-col gap-3">
            {!verified ? <InlineAlert tone="info">{tf('publishNeedsVerify')}</InlineAlert> : null}
            <PhotoUploader
              items={uploads}
              onAdd={(files) => void addFiles(files)}
              onRetry={(uid) => {
                const item = uploads.find((u) => u.id === uid);
                setUploads((u) => u.filter((x) => x.id !== uid));
                if (item?.file) void addFiles([item.file]);
              }}
              onRemove={async (uid) => {
                setUploads((u) => u.filter((x) => x.id !== uid));
                if (id && !uid.startsWith('local-')) await api.DELETE('/v1/dealer/listings/{id}/photos/{photoId}', { params: { path: { id, photoId: uid } } });
              }}
              onReorder={async (ids) => {
                setUploads((u) => ids.map((x) => u.find((i) => i.id === x)!));
                const ready = ids.filter((x) => !x.startsWith('local-'));
                if (id && ready.length) await api.PUT('/v1/dealer/listings/{id}/photos/order', { params: { path: { id } }, body: { photoIds: ready } });
              }}
            />
            <Button variant="secondary" onClick={() => router.push('/dealer/fleet')}>
              {t('saveDraft')}
            </Button>
          </div>
        ) : null}
      </Wizard>
    </div>
  );
}
