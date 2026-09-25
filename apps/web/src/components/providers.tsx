'use client';
import { ApiProvider } from '@agarha/api-client';
import type { Locale } from '@agarha/schemas';
import { ToastProvider, UiProvider } from '@agarha/ui-web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { startAnalytics } from '@/lib/analytics';
import { makeClient } from '@/lib/client';

export function Providers({
  locale,
  scope = 'customer',
  children,
}: {
  locale: Locale;
  scope?: 'customer' | 'dealer';
  children: ReactNode;
}) {
  const [qc] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  const [client] = useState(() => makeClient(scope, () => locale));
  useEffect(() => startAnalytics(), []);
  return (
    <QueryClientProvider client={qc}>
      <ApiProvider client={client}>
        <UiProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </UiProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
