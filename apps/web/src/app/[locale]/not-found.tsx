import { buttonVariants, EmptyState } from '@agarha/ui-web';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function NotFound() {
  const t = await getTranslations('web.errors');
  return (
    <main id="main" className="mx-auto max-w-2xl p-6">
      <EmptyState
        title={t('notFound')}
        body={t('notFoundBody')}
        action={
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            {t('goHome')}
          </Link>
        }
      />
    </main>
  );
}
