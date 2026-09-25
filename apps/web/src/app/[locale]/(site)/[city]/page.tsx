import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingView } from '@/components/landing-view';
import { landingMeta } from '@/lib/landing';
import { serverApi } from '@/lib/server-api';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; city: string }> }): Promise<Metadata> {
  const { locale, city } = await params;
  const data = await serverApi.landing(city);
  return data ? landingMeta(locale, data, `/${city}`) : {};
}

export default async function CityPage({ params }: { params: Promise<{ locale: string; city: string }> }) {
  const { locale, city } = await params;
  const data = await serverApi.landing(city);
  if (!data || !data.city.isActive) notFound();
  return <LandingView locale={locale as 'ar' | 'en'} data={data} />;
}
