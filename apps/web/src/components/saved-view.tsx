'use client';
import { keys, useApi, useFavorites, useMe } from '@agarha/api-client';
import { Button, EmptyState, InlineAlert, ListingCardSkeleton } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { listingPath } from '@/lib/listing-url';
import { ContactableCard } from './contact-actions';
import { FavoriteButton } from './favorite-button';
import { OtpSignIn } from './otp-sign-in';

export function SavedView() {
  const t = useTranslations('web.saved');
  const ta = useTranslations('web.account');
  const locale = useLocale();
  const me = useMe();
  const favs = useFavorites(!!me.data);
  const api = useApi();
  const qc = useQueryClient();
  const searches = useQuery({
    queryKey: keys.saved,
    enabled: !!me.data,
    queryFn: async () =>
      (await api.GET('/v1/me/saved-searches')).data as unknown as {
        items: {
          id: string;
          name: string | null;
          query: Record<string, string>;
          alertsEnabled: boolean;
        }[];
      },
  });

  if (me.isLoading) return <ListingCardSkeleton />;
  if (!me.data)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-fg-secondary">{ta('signInBody')}</p>
        <OtpSignIn onDone={() => void qc.invalidateQueries()} />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1">{t('title')}</h1>
      <section aria-labelledby="favs">
        <h2 id="favs" className="mb-3 text-h2">
          {t('favorites')}
        </h2>
        {favs.data?.unavailableIds.length ? (
          <InlineAlert tone="info">
            {t('unavailable', { count: favs.data.unavailableIds.length })}
          </InlineAlert>
        ) : null}
        {favs.data?.items.length ? (
          <ul className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favs.data.items.map((c) => (
              <li key={c.id}>
                <ContactableCard
                  card={c}
                  href={`/${locale}${listingPath(c)}`}
                  favorite={<FavoriteButton card={c} />}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            body={t('noFavorites')}
            action={
              <Link href="/search" className="text-brand underline">
                {t('goSearch')}
              </Link>
            }
          />
        )}
      </section>
      <section aria-labelledby="searches">
        <h2 id="searches" className="mb-3 text-h2">
          {t('searches')}
        </h2>
        {searches.data?.items.length ? (
          <ul className="flex flex-col gap-2">
            {searches.data.items.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
              >
                <Link
                  href={`/search?${new URLSearchParams(s.query)}`}
                  className="font-medium text-brand hover:underline"
                >
                  {s.name || Object.values(s.query).join(' · ')}
                </Link>
                <div className="flex items-center gap-2">
                  <label className="flex min-h-touch items-center gap-2 text-caption">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={s.alertsEnabled}
                      onChange={async (e) => {
                        await api.PATCH('/v1/me/saved-searches/{id}', {
                          params: { path: { id: s.id } },
                          body: { alertsEnabled: e.target.checked },
                        });
                        await searches.refetch();
                      }}
                    />
                    {t('alerts')}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api.DELETE('/v1/me/saved-searches/{id}', {
                        params: { path: { id: s.id } },
                      });
                      await searches.refetch();
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            body={t('noSearches')}
            action={
              <Link href="/search" className="text-brand underline">
                {t('goSearch')}
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
