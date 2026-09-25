import { redirect } from '@/i18n/routing';

export default async function DealerIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/dealer/fleet', locale });
}
