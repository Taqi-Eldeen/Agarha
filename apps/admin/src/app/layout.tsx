import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminProviders } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = { title: 'Agarha Ops', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
