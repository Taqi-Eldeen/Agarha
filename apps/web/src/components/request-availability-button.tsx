'use client';
import { useMe } from '@agarha/api-client';
import { Button } from '@agarha/ui-web';
import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';

const AvailabilityDrawer = dynamic(() => import('./request-availability').then((m) => m.AvailabilityDrawer), { ssr: false });

/** Phase 6: ask the dealer about specific dates. The drawer is loaded on demand. */
export function RequestAvailability({ listingId }: { listingId: string }) {
  const t = useTranslations('web.listing');
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={<CalendarClock aria-hidden className="size-5" strokeWidth={1.75} />} onClick={() => (me.data ? setOpen(true) : router.push(`/account?next=${encodeURIComponent(window.location.pathname)}`))}>
        {t('requestAvailability')}
      </Button>
      {open ? <AvailabilityDrawer listingId={listingId} open={open} setOpen={setOpen} /> : null}
    </>
  );
}
