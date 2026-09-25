import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DealerProviders } from '@/components/dealer/dealer-providers';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'أجّرها', statusBarStyle: 'default' },
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return <DealerProviders>{children}</DealerProviders>;
}
