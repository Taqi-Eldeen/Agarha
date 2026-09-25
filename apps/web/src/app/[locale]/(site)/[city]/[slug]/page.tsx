import { CAR_BODY_TYPES } from '@agarha/schemas';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingView } from '@/components/landing-view';
import { landingMeta } from '@/lib/landing';
import { serverApi } from '@/lib/server-api';

export const revalidate = 300;

/** /{city}/{area} or /{city}/{car-type}: a car type slug wins, anything else must be a known area. */
async function load(city: string, slug: string) {
  const isType = (CAR_BODY_TYPES as readonly string[]).includes(slug);
  const data = await serverApi.landing(city, isType ? { type: slug } : { area: slug });
  if (!data || !data.city.isActive || (!isType && !data.area)) return null;
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; city: string; slug: string }> }): Promise<Metadata> {
  const { locale, city, slug } = await params;
  const data = await load(city, slug);
  return data ? landingMeta(locale, data, `/${city}/${slug}`) : {};
}

export default async function AreaOrTypePage({ params }: { params: Promise<{ locale: string; city: string; slug: string }> }) {
  const { locale, city, slug } = await params;
  const data = await load(city, slug);
  if (!data) notFound();
  return <LandingView locale={locale as 'ar' | 'en'} data={data} />;
}
