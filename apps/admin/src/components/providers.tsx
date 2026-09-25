'use client';
import { ApiProvider, createApiClient } from '@agarha/api-client';
import { ToastProvider, UiProvider } from '@agarha/ui-web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AdminI18n, useT } from '@/lib/i18n';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function Inner({ children }: { children: ReactNode }) {
  const { locale } = useT();
  const [client] = useState(() =>
    createApiClient({ baseUrl: API, scope: 'admin', locale: () => locale }),
  );
  return (
    <ApiProvider client={client}>
      <UiProvider locale={locale}>
        <ToastProvider>{children}</ToastProvider>
      </UiProvider>
    </ApiProvider>
  );
}

export function AdminProviders({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <AdminI18n>
        <Inner>{children}</Inner>
      </AdminI18n>
    </QueryClientProvider>
  );
}
