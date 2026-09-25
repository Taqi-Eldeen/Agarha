'use client';
import { Languages } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';

/** Keeps the query string when switching language; Suspense because it reads search params. */
export function LanguageSwitch(props: { label: string }) {
  return (
    <Suspense fallback={null}>
      <Switch {...props} />
    </Suspense>
  );
}

function Switch({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      lang={other}
      onClick={() => router.replace(`${pathname}${search.size ? `?${search.toString()}` : ''}`, { locale: other })}
      className="inline-flex min-h-touch items-center gap-1 rounded-md px-3 text-caption hover:bg-brand-subtle"
    >
      <Languages aria-hidden className="size-5" strokeWidth={1.75} />
      {label}
    </button>
  );
}
