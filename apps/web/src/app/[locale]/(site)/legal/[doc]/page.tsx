import { LEGAL_DOCS, LEGAL_UPDATED, legalDoc, type LegalDoc } from '@agarha/i18n';
import { InlineAlert } from '@agarha/ui-web';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { alternates } from '@/lib/seo';

const TITLE: Record<LegalDoc, 'terms' | 'privacy' | 'dealerTerms'> = { terms: 'terms', privacy: 'privacy', 'dealer-terms': 'dealerTerms' };

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!LEGAL_DOCS.includes(doc as LegalDoc)) return {};
  const t = await getTranslations({ locale, namespace: 'web.legal' });
  return { title: t(TITLE[doc as LegalDoc]), alternates: alternates(locale, `/legal/${doc}`) };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  if (!LEGAL_DOCS.includes(doc as LegalDoc)) notFound();
  const t = await getTranslations('web.legal');
  const sections = legalDoc(doc as LegalDoc, locale as 'ar' | 'en');
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h1">{t(TITLE[doc as LegalDoc])}</h1>
        <p className="text-caption text-fg-secondary">{t('updated', { date: LEGAL_UPDATED })}</p>
      </header>
      <InlineAlert tone="info">{t('draftNotice')}</InlineAlert>
      {sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2">
          <h2 className="text-h2">{s.h}</h2>
          {s.p.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
