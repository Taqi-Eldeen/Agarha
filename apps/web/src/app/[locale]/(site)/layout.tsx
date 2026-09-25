import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* At least a viewport tall, so the footer starts below the fold and content streamed in after
          the shell (search results, dynamic pages) never pushes visible content down (CLS). */}
      <main id="main" className="mx-auto min-h-dvh w-full max-w-7xl px-4 py-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
