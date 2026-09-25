'use client';
import { useApi } from '@agarha/api-client';
import { formatRelative } from '@agarha/i18n';
import type { Listing, ModelRef } from '@agarha/schemas';
import { AvailabilitySwitch, Badge, Button, buttonVariants, EmptyState, ErrorState, InlineAlert, PriceTag, useToast } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useDealerMe } from '@/components/dealer/use-dealer';
import { Link } from '@/i18n/routing';
import { track } from '@/lib/analytics';

type FleetItem = Listing & { model: ModelRef | null };

export default function Fleet() {
  const t = useTranslations('dealer.fleet');
  const tu = useTranslations('ui');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useDealerMe();
  const fleet = useQuery({ queryKey: ['fleet'], queryFn: async () => (await api.GET('/v1/dealer/listings', { params: { query: { limit: 100 } } })).data as unknown as { items: FleetItem[]; counts: Record<string, number> } });
  const items = fleet.data?.items ?? [];
  const needsConfirm = items.filter((i) => (i.status === 'live' && i.freshness !== 'fresh') || i.hiddenReason === 'stale').length;
  const verified = me.data?.dealer.status === 'verified';

  const act = async (id: string, action: 'publish' | 'pause' | 'archive') => {
    try {
      await api.POST(`/v1/dealer/listings/{id}/${action}` as '/v1/dealer/listings/{id}/publish', { params: { path: { id } } });
      await qc.invalidateQueries({ queryKey: ['fleet'] });
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<CheckCheck aria-hidden className="size-5" strokeWidth={1.75} />}
            onClick={async () => {
              const { data } = await api.POST('/v1/dealer/listings/confirm-all');
              track('dealer_confirm_all', {});
              toast({ tone: 'success', text: t('confirmAllDone', { count: (data as unknown as { confirmed: number }).confirmed }) });
              await qc.invalidateQueries({ queryKey: ['fleet'] });
            }}
          >
            {t('confirmAll')}
          </Button>
          <Link href="/dealer/fleet/new" className={buttonVariants({})}>
            <Plus aria-hidden className="size-5" strokeWidth={1.75} />
            {t('add')}
          </Link>
        </div>
      </div>
      {!verified && me.data ? <InlineAlert tone="info">{t('publishNeedsVerify')}</InlineAlert> : null}
      {needsConfirm ? <InlineAlert tone="warning">{t('confirmBanner', { count: needsConfirm })}</InlineAlert> : null}
      {fleet.isError ? <ErrorState body={tu('errorTitle')} onRetry={() => void fleet.refetch()} /> : null}
      {fleet.isSuccess && !items.length ? <EmptyState body={t('empty')} action={<Link href="/dealer/fleet/new" className={buttonVariants({})}>{t('add')}</Link>} /> : null}
      <ul className="flex flex-col gap-3">
        {items.map((l) => {
          const name = l.model ? `${locale === 'ar' ? l.model.makeNameAr : l.model.makeNameEn} ${locale === 'ar' ? l.model.nameAr : l.model.nameEn}` : '';
          const photo = l.photos[0]?.urls?.webp?.['320'];
          return (
            <li key={l.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center">
              <div className="flex flex-1 gap-3">
                <div className="size-20 shrink-0 overflow-hidden rounded-md bg-brand-subtle">{photo ? <img src={photo} alt="" className="size-full object-cover" /> : null}</div>
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/dealer/fleet/${l.id}`} className="font-semibold hover:underline">
                    {name} <span className="ag-tabular">{l.year}</span>
                  </Link>
                  <PriceTag prices={l.prices} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption">{t(`statuses.${l.status}`)}</span>
                    {l.featured ? <Badge kind="featured" /> : null}
                    <span className="text-caption text-fg-secondary">{t('lastConfirmed', { ago: formatRelative(new Date(l.lastConfirmedAt), locale) })}</span>
                  </div>
                  {l.hiddenReason === 'stale' ? <p className="text-caption text-stale">{t('hiddenStale')}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {l.status === 'live' ? (
                  <AvailabilitySwitch
                    available={l.available}
                    label={`${name} ${l.year}`}
                    onChange={async (available) => {
                      await api.PUT('/v1/dealer/listings/{id}/availability', { params: { path: { id: l.id } }, body: { available } });
                      track('dealer_availability_toggled', { available });
                    }}
                    onChanged={(v, undo) => toast({ tone: 'success', text: `${tu('availabilityUpdated')}: ${v ? tu('available') : tu('unavailable')}`, action: { label: tu('undo'), onClick: undo } })}
                  />
                ) : null}
                {['draft', 'paused'].includes(l.status) || l.hiddenReason === 'stale' ? (
                  <Button size="sm" disabled={!verified} onClick={() => void act(l.id, 'publish')}>
                    {t('publish')}
                  </Button>
                ) : null}
                {l.status === 'live' ? (
                  <Button size="sm" variant="secondary" onClick={() => void act(l.id, 'pause')}>
                    {t('pause')}
                  </Button>
                ) : null}
                <Link href={`/dealer/fleet/${l.id}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
                  {t('edit')}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
