import { useApi, useFavorites } from '@agarha/api-client';
import {
  Button,
  ChipGroup,
  EmptyState,
  InlineAlert,
  ListingCardSkeleton,
  Text,
} from '@agarha/ui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { FavoriteButton } from '@/components/favorite-button';
import { Screen } from '@/components/screen';
import { SearchResultCard } from '@/components/search-result-card';
import { useSession } from '@/lib/session';

interface SavedSearch {
  id: string;
  name: string;
  query: Record<string, string | number | boolean>;
  alertsEnabled: boolean;
}

export default function Saved() {
  const t = useTranslations();
  const router = useRouter();
  const api = useApi();
  const qc = useQueryClient();
  const { signedIn } = useSession();
  const [tab, setTab] = useState<'favorites' | 'searches'>('favorites');
  const favorites = useFavorites(!!signedIn);
  const searches = useQuery({
    queryKey: ['saved-searches'],
    enabled: !!signedIn,
    queryFn: async () =>
      ((await api.GET('/v1/me/saved-searches')).data as unknown as { items: SavedSearch[] }).items,
  });

  if (!signedIn)
    return (
      <Screen>
        <Text variant="h1" accessibilityRole="header">
          {t('web.saved.title')}
        </Text>
        <EmptyState
          body={t('app.account.signInToSave')}
          action={<Button onPress={() => router.push('/sign-in')}>{t('common.signIn')}</Button>}
        />
      </Screen>
    );

  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header">
        {t('web.saved.title')}
      </Text>
      <ChipGroup
        label={t('web.saved.title')}
        single
        value={[tab]}
        onChange={(v) => v[0] && setTab(v[0] as typeof tab)}
        options={[
          { value: 'favorites', label: t('web.saved.favorites') },
          { value: 'searches', label: t('web.saved.searches') },
        ]}
      />
      {tab === 'favorites' ? (
        <View className="gap-4">
          {favorites.data?.unavailableIds.length ? (
            <InlineAlert tone="warning">
              {t('web.saved.unavailable', { count: favorites.data.unavailableIds.length })}
            </InlineAlert>
          ) : null}
          {favorites.isPending ? <ListingCardSkeleton /> : null}
          {favorites.data && !favorites.data.items.length ? (
            <EmptyState
              body={t('web.saved.noFavorites')}
              action={<Button onPress={() => router.push('/')}>{t('web.saved.goSearch')}</Button>}
            />
          ) : null}
          {favorites.data?.items.map((c) => (
            <SearchResultCard
              key={c.id}
              card={c}
              source="saved"
              favorite={<FavoriteButton listingId={c.id} card={c} />}
            />
          ))}
        </View>
      ) : (
        <View className="gap-3">
          {searches.data && !searches.data.length ? (
            <EmptyState body={t('web.saved.noSearches')} />
          ) : null}
          {searches.data?.map((s) => (
            <View key={s.id} className="gap-2 rounded-md border border-border bg-card p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1" weight="medium">
                  {s.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {t('web.saved.alerts')}
                </Text>
                <Switch
                  accessibilityLabel={`${t('web.saved.alerts')}: ${s.name}`}
                  value={s.alertsEnabled}
                  onValueChange={async (v) => {
                    await api.PATCH('/v1/me/saved-searches/{id}', {
                      params: { path: { id: s.id } },
                      body: { alertsEnabled: v },
                    });
                    await qc.invalidateQueries({ queryKey: ['saved-searches'] });
                  }}
                />
              </View>
              <View className="flex-row justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/search',
                      params: Object.fromEntries(
                        Object.entries(s.query).map(([k, v]) => [k, String(v)]),
                      ),
                    })
                  }
                >
                  {t('web.saved.open')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={async () => {
                    await api.DELETE('/v1/me/saved-searches/{id}', {
                      params: { path: { id: s.id } },
                    });
                    await qc.invalidateQueries({ queryKey: ['saved-searches'] });
                  }}
                >
                  {t('web.saved.delete')}
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
