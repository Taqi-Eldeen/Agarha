'use client';
import { ErrorState } from '@agarha/ui-web';
import { reportError } from '@/lib/report-error';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('web.errors');
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto max-w-2xl p-6">
      <ErrorState body={t('generic')} onRetry={reset} requestId={error.digest} />
    </main>
  );
}
