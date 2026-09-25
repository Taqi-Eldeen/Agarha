'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { Button, InlineAlert, useToast } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { env } from '@/lib/env';

type Validation = { importId: string; status: 'ready' | 'failed'; rowCount: number; errors: { row: number; field: string; code: string }[] };
const TEMPLATE = 'make,model,year,color,transmission,fuel,seats,driver_option,price_day,price_week,price_month,deposit,min_age,required_docs,km_limit_per_day,airport_pickup,branch\nToyota,Corolla,2024,white,automatic,petrol,5,self,1500,9000,,5000,23,national_id|egyptian_driving_licence,200,no,\n';

export default function Import() {
  const t = useTranslations('dealer.import');
  const api = useApi();
  const toast = useToast();
  const [v, setV] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      <p className="text-fg-secondary">{t('body')}</p>
      <a className="self-start text-brand underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="agarha-cars-template.csv">
        {t('template')}
      </a>
      <label className="inline-flex min-h-touch cursor-pointer items-center self-start rounded-md border border-border px-4 hover:bg-brand-subtle">
        {busy ? t('validating') : t('choose')}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/dealer/listings/import`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'text/csv' }, body: await file.text() });
              setV((await res.json()) as Validation);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {v && v.status === 'failed' ? (
        <InlineAlert tone="danger" title={t('errors', { count: v.errors.length })}>
          <ul>
            {v.errors.slice(0, 50).map((er) => (
              <li key={`${er.row}-${er.field}`}>{t('row', { row: er.row, field: er.field, code: er.code })}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}
      {v && v.status === 'ready' ? (
        <>
          <InlineAlert tone="success">{t('ready', { count: v.rowCount })}</InlineAlert>
          <Button
            className="self-start"
            onClick={async () => {
              try {
                const { data } = await api.POST('/v1/dealer/listings/import/{id}/apply', { params: { path: { id: v.importId } } });
                toast({ tone: 'success', text: t('applied', { count: (data as unknown as { created: number }).created }) });
                setV(null);
              } catch (err) {
                toast({ tone: 'danger', text: (err as ApiRequestError).message });
              }
            }}
          >
            {t('apply')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
