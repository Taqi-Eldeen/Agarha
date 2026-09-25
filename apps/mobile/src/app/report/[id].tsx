import { ApiRequestError, useApi } from '@agarha/api-client';
import { Button, ChipGroup, EmptyState, Text, TextField, useToast } from '@agarha/ui-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/session';

const REASONS = ['scam_or_deposit_request', 'car_not_available', 'wrong_price', 'wrong_photos', 'rude_or_unsafe', 'other'] as const;

/** Report a listing (needs an account so reports can be followed up and abuse is limited). */
export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const { signedIn } = useSession();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (!signedIn)
    return (
      <Screen edges={['bottom']}>
        <EmptyState body={t('errors.unauthorized')} action={<Button onPress={() => router.replace('/sign-in')}>{t('common.signIn')}</Button>} />
      </Screen>
    );

  const submit = async () => {
    if (!reason || !id) return;
    setBusy(true);
    try {
      await api.POST('/v1/reports', { body: { listingId: id, reason, ...(details.trim() ? { details: details.trim() } : {}) } });
      track('listing_reported', { listing_id: id, reason });
      toast({ tone: 'success', text: t('web.report.thanks') });
      router.back();
    } catch (e) {
      const code = e instanceof ApiRequestError ? e.code : 'internal_error';
      toast({ tone: 'danger', text: t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.internal_error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text weight="semibold">{t('web.report.reason')}</Text>
      <ChipGroup label={t('web.report.reason')} single value={reason ? [reason] : []} onChange={(v) => setReason((v[0] as (typeof REASONS)[number]) ?? null)} options={REASONS.map((r) => ({ value: r, label: t(`web.report.reasons.${r}`) }))} />
      <TextField label={t('web.report.details')} value={details} onChangeText={setDetails} multiline maxLength={1000} optional className="h-28 py-2" textAlignVertical="top" />
      <Button block disabled={!reason} loading={busy} onPress={() => void submit()}>
        {t('web.report.submit')}
      </Button>
    </Screen>
  );
}
