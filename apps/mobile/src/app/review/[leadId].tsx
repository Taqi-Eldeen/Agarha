import { ApiRequestError, useApi, useListing } from '@agarha/api-client';
import { Button, RatingStars, Text, TextField, useToast, useUi } from '@agarha/ui-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { track } from '@/lib/analytics';

/** Lead-gated review: only for a lead this account sent, ≥ 24h old (the API enforces both). */
export default function WriteReview() {
  const { leadId, listingId } = useLocalSearchParams<{ leadId: string; listingId?: string }>();
  const t = useTranslations();
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { locale } = useUi();
  const listing = useListing(listingId);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const dealer = listing.data
    ? locale === 'ar'
      ? listing.data.dealer.nameAr
      : listing.data.dealer.nameEn
    : '';
  const submit = async () => {
    setBusy(true);
    try {
      await api.POST('/v1/reviews', {
        body: { leadId, rating, ...(body.trim().length >= 3 ? { body: body.trim() } : {}) },
      });
      track('review_submitted', { rating });
      await qc.invalidateQueries({ queryKey: ['reviewable'] });
      toast({ tone: 'success', text: t('web.review.thanks') });
      router.back();
    } catch (e) {
      const code = e instanceof ApiRequestError ? e.code : 'internal_error';
      toast({
        tone: 'danger',
        text: t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.internal_error'),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['bottom']}>
      {dealer ? (
        <Text variant="h2" accessibilityRole="header">
          {t('web.review.title', { dealer })}
        </Text>
      ) : null}
      <Text weight="medium">{t('web.review.rating')}</Text>
      <RatingStars value={rating} onChange={setRating} />
      <TextField
        label={t('web.review.body')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={1000}
        optional
        className="h-28 py-2"
        textAlignVertical="top"
      />
      <Button block disabled={!rating} loading={busy} onPress={() => void submit()}>
        {t('web.review.submit')}
      </Button>
    </Screen>
  );
}
