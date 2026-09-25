import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AccountView } from '@/components/account-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.account');
  return { title: t('title'), robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
