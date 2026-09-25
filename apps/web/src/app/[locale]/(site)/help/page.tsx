import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';
import { alternates, JsonLdScript } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'web.help' });
  return { title: t('title'), alternates: alternates(locale, '/help') };
}

const QS = ['1', '2', '3', '4', '5', '6'] as const;

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('web.help');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: QS.map((i) => ({
            '@type': 'Question',
            name: t(`faq.q${i}`),
            acceptedAnswer: { '@type': 'Answer', text: t(`faq.a${i}`) },
          })),
        }}
      />
      <h1 className="text-h1">{t('title')}</h1>
      <section
        aria-labelledby="safety"
        className="rounded-lg border border-stale/40 bg-stale/10 p-4"
      >
        <h2 id="safety" className="mb-3 flex items-center gap-2 text-h2">
          <ShieldCheck aria-hidden className="size-6" strokeWidth={1.75} />
          {t('safetyTitle')}
        </h2>
        <ul className="list-disc ps-6">
          {(['s1', 's2', 's3', 's4'] as const).map((k) => (
            <li key={k} className="py-1">
              {t(`safety.${k}`)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="faq">
        <h2 id="faq" className="mb-3 text-h2">
          {t('faqTitle')}
        </h2>
        {QS.map((i) => (
          <details key={i} className="border-b border-border py-3">
            <summary className="min-h-touch cursor-pointer py-2 font-semibold">
              {t(`faq.q${i}`)}
            </summary>
            <p className="pt-1 text-fg-secondary">{t(`faq.a${i}`)}</p>
          </details>
        ))}
      </section>
      <p>{t('contact')}</p>
    </div>
  );
}
