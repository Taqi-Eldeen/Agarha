import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SavedView } from '@/components/saved-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.saved');
  return { title: t('title'), robots: { index: false } };
}

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedView />;
}
