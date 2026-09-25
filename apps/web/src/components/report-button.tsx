'use client';
import { useMe } from '@agarha/api-client';
import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';

// The drawer (Radix Dialog + Select) loads only when someone actually reports.
const ReportDrawer = dynamic(() => import('./report-dialog').then((m) => m.ReportDrawer), {
  ssr: false,
});

export function ReportButton({ listingId }: { listingId: string }) {
  const tl = useTranslations('web.listing');
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-touch items-center gap-2 text-caption text-fg-secondary hover:text-danger"
        onClick={() =>
          me.data
            ? setOpen(true)
            : router.push(`/account?next=${encodeURIComponent(window.location.pathname)}`)
        }
      >
        <Flag aria-hidden className="size-4" strokeWidth={1.75} />
        {tl('report')}
      </button>
      {open ? <ReportDrawer listingId={listingId} open={open} setOpen={setOpen} /> : null}
    </>
  );
}
