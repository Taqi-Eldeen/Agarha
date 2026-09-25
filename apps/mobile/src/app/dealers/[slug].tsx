import { useDealerProfile } from '@agarha/api-client';
import type { ListingCard } from '@agarha/schemas';
import {
  DealerCard,
  EmptyState,
  ErrorState,
  ListingCardSkeleton,
  ReviewItem,
  Text,
  useUi,
} from '@agarha/ui-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { SearchResultCard } from '@/components/search-result-card';

export default function DealerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useDealerProfile(slug);
  const t = useTranslations('web');
  const format = useFormatter();
  const { locale, colors } = useUi();
  if (q.isPending)
    return (
      <View className="flex-1 bg-page p-4">
        <ListingCardSkeleton />
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View className="flex-1 bg-page p-4">
        <ErrorState body={t('search.errorBody')} onRetry={() => void q.refetch()} />
      </View>
    );
  const { dealer, branches, reviews, responseRate, fleet, fleetTotal } = q.data;
  const name = locale === 'ar' ? dealer.nameAr : dealer.nameEn;
  const description = locale === 'ar' ? dealer.descriptionAr : dealer.descriptionEn;
  return (
    <ScrollView className="flex-1 bg-page" contentContainerClassName="gap-6 p-4 pb-8">
      <Stack.Screen options={{ title: name }} />
      <DealerCard
        name={name}
        verified={dealer.verified}
        reviews={{ count: reviews.count, average: reviews.average }}
        responseRate={responseRate}
        responseRateLabel={
          responseRate === null
            ? ''
            : t('listing.responseRate', { percent: Math.round(responseRate * 100) })
        }
        memberSinceLabel={t('listing.memberSince', {
          date: format.dateTime(new Date(dealer.memberSince), { month: 'long', year: 'numeric' }),
        })}
      />
      {description ? <Text>{description}</Text> : null}

      {branches.length ? (
        <View className="gap-2">
          <Text variant="h2">{t('dealerPage.branches')}</Text>
          {branches.map((b) => (
            <View key={b.id} className="flex-row gap-3 rounded-md border border-border bg-card p-3">
              <MapPin size={20} color={colors.brandPrimary} strokeWidth={1.75} />
              <View className="flex-1">
                <Text weight="medium">{locale === 'ar' ? b.nameAr : b.nameEn}</Text>
                <Text variant="caption" tone="secondary">
                  {[
                    b.area ? (locale === 'ar' ? b.area.nameAr : b.area.nameEn) : null,
                    locale === 'ar' ? b.addressAr : b.addressEn,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text variant="h2">{t('dealerPage.fleet', { count: fleetTotal })}</Text>
        {(fleet as ListingCard[]).map((c) => (
          <SearchResultCard key={c.id} card={c} source="dealer_page" />
        ))}
      </View>

      <View className="gap-1">
        <Text variant="h2">{t('dealerPage.reviews')}</Text>
        {reviews.latest.length ? (
          reviews.latest.map((r) => (
            <ReviewItem
              key={r.id}
              rating={r.rating}
              body={r.body}
              date={r.createdAt}
              reply={r.dealerReply}
            />
          ))
        ) : (
          <EmptyState body={t('dealerPage.noReviews')} />
        )}
      </View>
    </ScrollView>
  );
}
