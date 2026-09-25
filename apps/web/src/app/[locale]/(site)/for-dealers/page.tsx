import { BarChart3, Clock, MessageCircle, ToggleRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buttonVariants, InlineAlert } from '@agarha/ui-web';
import { Link } from '@/i18n/routing';
import { alternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'web.forDealers' });
  return { title: t('title'), description: t('subtitle'), alternates: alternates(locale, '/for-dealers') };
}

export default async function ForDealers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('web.forDealers');
  const benefits = [
    { icon: MessageCircle, title: t('b1Title'), body: t('b1Body') },
    { icon: Clock, title: t('b2Title'), body: t('b2Body') },
    { icon: ToggleRight, title: t('b3Title'), body: t('b3Body') },
    { icon: BarChart3, title: t('b4Title'), body: t('b4Body') },
  ];
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-4 rounded-lg bg-brand-subtle p-6 md:p-10">
        <h1 className="max-w-3xl font-display text-display">{t('title')}</h1>
        <p className="max-w-2xl text-fg-secondary">{t('subtitle')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dealer/sign-up" className={buttonVariants({ size: 'lg' })}>{t('cta')}</Link>
          <Link href="/dealer/sign-in" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>{t('signIn')}</Link>
        </div>
      </section>
      <section aria-labelledby="benefits">
        <h2 id="benefits" className="mb-4 text-h2">{t('benefitsTitle')}</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {benefits.map((b) => (
            <li key={b.title} className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <b.icon aria-hidden className="size-7 shrink-0 text-brand" strokeWidth={1.75} />
              <div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-fg-secondary">{b.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="steps">
        <h2 id="steps" className="mb-4 text-h2">{t('stepsTitle')}</h2>
        <ol className="grid gap-3 md:grid-cols-4">
          {(['step1', 'step2', 'step3', 'step4'] as const).map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <span className="ag-tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white dark:text-page">{i + 1}</span>
              {t(s)}
            </li>
          ))}
        </ol>
      </section>
      <InlineAlert tone="info">{t('requirements')}</InlineAlert>
    </div>
  );
}
