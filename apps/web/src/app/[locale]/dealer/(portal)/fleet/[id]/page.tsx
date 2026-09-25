'use client';
import { useApi } from '@agarha/api-client';
import type { Listing, ModelRef } from '@agarha/schemas';
import { ErrorState, ListingCardSkeleton } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { CarWizard } from '@/components/dealer/car-wizard';

export default function EditCar() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const tu = useTranslations('ui');
  const q = useQuery({ queryKey: ['dealer-listing', id], queryFn: async () => (await api.GET('/v1/dealer/listings/{id}', { params: { path: { id } } })).data as unknown as Listing & { model: ModelRef | null } });
  if (q.isLoading) return <ListingCardSkeleton />;
  if (q.isError || !q.data) return <ErrorState body={tu('errorTitle')} onRetry={() => void q.refetch()} />;
  return <CarWizard listing={q.data} />;
}
