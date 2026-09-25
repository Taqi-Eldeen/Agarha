'use client';
import { ApiProvider } from '@agarha/api-client';
import { useLocale } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { makeClient } from '@/lib/client';

/** Dealer pages use the dealer-scope session (separate cookies from the customer session). */
export function DealerProviders({ children }: { children: ReactNode }) {
  const locale = useLocale() as 'ar' | 'en';
  const [client] = useState(() => makeClient('dealer', () => locale));
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker.register('/sw.js');
  }, []);
  return <ApiProvider client={client}>{children}</ApiProvider>;
}
