import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { DealerProviders } from '@/components/dealer/dealer-providers';
import { DEALER_NAMESPACES, pickMessages } from '@/lib/messages';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'أجّرها', statusBarStyle: 'default' },
};

export default async function DealerLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, DEALER_NAMESPACES)}>
      <DealerProviders>{children}</DealerProviders>
    </NextIntlClientProvider>
  );
}
