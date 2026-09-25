'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { formatDate, formatEgp } from '@agarha/i18n';
import type { Plan } from '@agarha/schemas';
import { Button, InlineAlert, Select, TextField, useToast } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Overview = {
  subscription: { planCode: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  limits: { planCode: string; featuredCreditsRemaining: number };
  invoices: { id: string; number: string; status: 'draft' | 'open' | 'paid' | 'void' | 'failed'; totalEgp: number; vatEgp: number; createdAt: string }[];
  featuredPricePerDayEgp: number;
};

export default function Billing() {
  const t = useTranslations('dealer.billing');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const toast = useToast();
  const plans = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.GET('/v1/plans')).data!.items as Plan[] });
  const ov = useQuery({ queryKey: ['billing'], queryFn: async () => (await api.GET('/v1/dealer/billing')).data as unknown as Overview });
  const fleet = useQuery({ queryKey: ['fleet-live'], queryFn: async () => (await api.GET('/v1/dealer/listings', { params: { query: { status: 'live', limit: 100 } } })).data as unknown as { items: { id: string; year: number; model: { nameAr: string; nameEn: string; makeNameAr: string; makeNameEn: string } | null }[] } });
  const me = useQuery({ queryKey: ['dealer-me'], queryFn: async () => (await api.GET('/v1/dealer/me')).data as unknown as { dealer: { legalName: string; phoneE164: string } } });
  const [listingId, setListingId] = useState<string>();
  const [days, setDays] = useState('7');
  const contact = { contactName: me.data?.dealer.legalName ?? 'Dealer', contactPhone: me.data?.dealer.phoneE164 ?? '', locale };
  const go = async (fn: () => Promise<{ checkoutUrl: string | null }>) => {
    try {
      const r = await fn();
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else {
        toast({ tone: 'success', text: t('paid') });
        await ov.refetch();
      }
    } catch (e) {
      toast({ tone: 'danger', text: (e as ApiRequestError).message });
    }
  };
  const current = plans.data?.find((p) => p.code === (ov.data?.limits.planCode ?? 'free'));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">{t('title')}</h1>
      <InlineAlert tone="info">{t('customersNeverPay')}</InlineAlert>
      {current ? (
        <p className="text-body font-semibold">
          {t('current', { plan: locale === 'ar' ? current.nameAr : current.nameEn })}
          {ov.data?.subscription?.currentPeriodEnd ? <span className="ms-2 text-caption font-normal text-fg-secondary">{ov.data.subscription.cancelAtPeriodEnd ? t('cancelled') : t('renews', { date: formatDate(new Date(ov.data.subscription.currentPeriodEnd), locale) })}</span> : null}
        </p>
      ) : null}
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((p) => (
          <li key={p.code} className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${p.code === current?.code ? 'border-brand' : 'border-border'}`}>
            <h2 className="text-h2">{locale === 'ar' ? p.nameAr : p.nameEn}</h2>
            <p className="text-price font-semibold">{p.priceMonthlyEgp ? t('perMonth', { price: formatEgp(p.priceMonthlyEgp, locale) }) : t('free')}</p>
            <ul className="text-caption text-fg-secondary">
              <li>{p.maxLiveListings ? t('liveLimit', { count: p.maxLiveListings }) : t('unlimited')}</li>
              <li>{t('teamLimit', { count: p.maxTeamMembers })}</li>
              <li>{t('featuredCredits', { count: p.featuredCreditsPerMonth })}</li>
            </ul>
            {p.code !== current?.code ? (
              <Button className="mt-auto" variant={p.priceMonthlyEgp ? 'primary' : 'secondary'} onClick={() => void go(async () => (await api.POST('/v1/dealer/billing/subscribe', { body: { planCode: p.code, ...contact }, headers: { 'idempotency-key': crypto.randomUUID() } })).data as unknown as { checkoutUrl: string | null })}>
                {t('choose')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {ov.data?.subscription && ov.data.subscription.planCode !== 'free' && !ov.data.subscription.cancelAtPeriodEnd ? (
        <Button variant="ghost" className="self-start" onClick={async () => { await api.POST('/v1/dealer/billing/cancel'); await ov.refetch(); toast({ tone: 'success', text: t('cancelled') }); }}>
          {t('cancel')}
        </Button>
      ) : null}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-h2">{t('featureTitle')}</h2>
        <Select label={t('featureTitle')} value={listingId} onValueChange={setListingId} options={(fleet.data?.items ?? []).map((l) => ({ value: l.id, label: `${locale === 'ar' ? `${l.model?.makeNameAr} ${l.model?.nameAr}` : `${l.model?.makeNameEn} ${l.model?.nameEn}`} ${l.year}` }))} />
        <TextField label={t('featureDays')} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} dir="ltr" />
        <p className="text-caption text-fg-secondary">{ov.data?.limits.featuredCreditsRemaining ? t('featureCredit', { count: ov.data.limits.featuredCreditsRemaining }) : t('featurePrice', { price: formatEgp(ov.data?.featuredPricePerDayEgp ?? 0, locale) })}</p>
        <Button className="self-start" disabled={!listingId || !Number(days)} onClick={() => void go(async () => (await api.POST('/v1/dealer/billing/feature', { body: { listingId: listingId!, days: Number(days), ...contact }, headers: { 'idempotency-key': crypto.randomUUID() } })).data as unknown as { checkoutUrl: string | null })}>
          {t('pay')}
        </Button>
      </section>
      <section>
        <h2 className="mb-3 text-h2">{t('invoices')}</h2>
        <ul className="flex flex-col gap-2">
          {ov.data?.invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <span dir="ltr" className="font-mono">{i.number}</span>
              <span>{formatEgp(i.totalEgp, locale)}</span>
              <span className="text-caption text-fg-secondary">{t('vatIncluded', { vat: formatEgp(i.vatEgp, locale) })}</span>
              <span className="text-caption">{t(`statuses.${i.status}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
