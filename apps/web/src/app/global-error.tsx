'use client';
import { reportError } from '@/lib/report-error';
import { useEffect } from 'react';

/** Last-resort boundary (root layout failed): plain bilingual copy, no providers available. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui', padding: 24 }}>
        {/* eslint-disable-next-line agarha/no-jsx-literal -- root layout failed, catalogs are unavailable */}
        <h1>حصلت مشكلة · Something went wrong</h1>
      </body>
    </html>
  );
}
