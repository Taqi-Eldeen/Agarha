import { getTranslations } from 'next-intl/server';
import { Heart, Menu, UserRound } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { HeaderSearch } from './header-search';
import { LanguageSwitch } from './language-switch';
import { Logo } from './logo';

export async function SiteHeader() {
  const t = await getTranslations('web.nav');
  return (
    <header className="sticky top-0 z-header border-b border-border bg-card/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-toast focus:rounded-md focus:bg-card focus:p-2"
      >
        {t('skip')}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t('home')}>
          <Logo />
        </Link>
        <div className="hidden flex-1 md:block">
          <HeaderSearch />
        </div>
        <nav aria-label={t('menu')} className="ms-auto flex items-center gap-1">
          <Link
            href="/for-dealers"
            className="hidden min-h-touch items-center rounded-md px-3 text-caption font-medium text-brand hover:bg-brand-subtle lg:inline-flex"
          >
            {t('forDealers')}
          </Link>
          <Link
            href="/saved"
            className="inline-flex size-12 items-center justify-center rounded-md hover:bg-brand-subtle"
            aria-label={t('saved')}
          >
            <Heart aria-hidden className="size-5" strokeWidth={1.75} />
          </Link>
          <LanguageSwitch label={t('switchTo')} />
          <Link
            href="/account"
            className="inline-flex min-h-touch items-center gap-2 rounded-md px-3 hover:bg-brand-subtle"
            aria-label={t('account')}
          >
            <UserRound aria-hidden className="size-5" strokeWidth={1.75} />
            <span className="hidden text-caption md:inline">{t('account')}</span>
          </Link>
          <Link
            href="/help"
            className="inline-flex size-12 items-center justify-center rounded-md hover:bg-brand-subtle md:hidden"
            aria-label={t('menu')}
          >
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
