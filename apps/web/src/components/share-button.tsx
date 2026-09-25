'use client';
import { useToast } from '@agarha/ui-web';
import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ShareButton({ title, url }: { title: string; url: string }) {
  const t = useTranslations('web.listing');
  const done = useTranslations('web.account');
  const toast = useToast();
  return (
    <button
      type="button"
      className="inline-flex min-h-touch items-center gap-2 rounded-md border border-border px-3"
      onClick={async () => {
        if (navigator.share) await navigator.share({ title, url }).catch(() => undefined);
        else {
          await navigator.clipboard.writeText(url);
          toast({ tone: 'success', text: done('saved') });
        }
      }}
    >
      <Share2 aria-hidden className="size-5" strokeWidth={1.75} />
      {t('share')}
    </button>
  );
}
