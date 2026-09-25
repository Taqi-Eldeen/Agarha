'use client';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';

export function HeaderSearch() {
  const t = useTranslations('web.search');
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      }}
      className="flex max-w-md items-center gap-2 rounded-full border border-border bg-page ps-4"
    >
      <label htmlFor="header-q" className="sr-only">
        {t('q')}
      </label>
      <input
        id="header-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('q')}
        className="h-11 flex-1 bg-transparent text-body outline-none"
      />
      <button
        type="submit"
        aria-label={t('title')}
        className="inline-flex size-11 items-center justify-center rounded-full bg-brand text-white dark:text-page"
      >
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    </form>
  );
}
