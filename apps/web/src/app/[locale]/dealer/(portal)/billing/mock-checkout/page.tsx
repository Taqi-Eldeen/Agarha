'use client';
import { formatEgp } from '@agarha/i18n';
import { Button, InlineAlert } from '@agarha/ui-web';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { env } from '@/lib/env';

/** Stand-in for the payment gateway's hosted checkout (mock gateway, non-production only). */
export default function MockCheckoutPage() {
  return (
    <Suspense>
      <MockCheckout />
    </Suspense>
  );
}

function MockCheckout() {
  const t = useTranslations('dealer.billing');
  const locale = useLocale() as 'ar' | 'en';
  const sp = useSearchParams();
  const router = useRouter();
  const invoice = sp.get('invoice') ?? '';
  const amount = Number(sp.get('amount') ?? 0);
  const [busy, setBusy] = useState(false);
  const pay = async (success: boolean) => {
    setBusy(true);
    await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/dev/payments/mock/${invoice}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountEgp: amount, success }),
    });
    router.replace('/dealer/billing');
  };
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-h1">{t('mockTitle')}</h1>
      <InlineAlert tone="warning">{t('mockBody')}</InlineAlert>
      <Button size="lg" loading={busy} onClick={() => void pay(true)}>
        {t('mockPay', { amount: formatEgp(amount, locale) })}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => void pay(false)}>
        {t('mockFail')}
      </Button>
    </div>
  );
}
