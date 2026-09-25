import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export async function SiteFooter() {
  const t = await getTranslations('web');
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-fg-secondary">{t('footer.notAParty')}</p>
          <p className="text-caption text-fg-secondary">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </p>
        </div>
        <nav aria-label={t('nav.help')} className="flex flex-wrap gap-4 text-caption">
          <Link href="/dealers" className="hover:underline">
            {t('nav.dealers')}
          </Link>
          <Link href="/for-dealers" className="hover:underline">
            {t('nav.forDealers')}
          </Link>
          <Link href="/help" className="hover:underline">
            {t('nav.help')}
          </Link>
          <Link href="/legal/terms" className="hover:underline">
            {t('footer.terms')}
          </Link>
          <Link href="/legal/privacy" className="hover:underline">
            {t('footer.privacy')}
          </Link>
          <Link href="/legal/dealer-terms" className="hover:underline">
            {t('footer.dealerTerms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
