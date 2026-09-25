import { ApiRequestError, useApi } from '@agarha/api-client';
import { Button, ChipGroup, InlineAlert, TextField, useToast } from '@agarha/ui-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { track } from '@/lib/analytics';
import { cairoDate } from '@/lib/dates';
import { useLocale } from '@/lib/i18n';
import { useSession } from '@/lib/session';

const DURATIONS = [1, 2, 3, 5, 7, 14, 30];

/** "Is it free on these dates?" (P6). A question to the dealer, not a booking. */
export default function RequestAvailability() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const format = useFormatter();
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const { locale } = useLocale();
  const { signedIn } = useSession();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => cairoDate(i + 1)), []);
  const [start, setStart] = useState(days[0]!);
  const [duration, setDuration] = useState(3);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (signedIn === false) return <Redirect href="/sign-in" />;
  const submit = async () => {
    setBusy(true);
    try {
      const endDate = cairoDate(duration - 1, new Date(`${start}T12:00:00+02:00`));
      await api.POST('/v1/availability-requests', {
        body: {
          listingId: id,
          startDate: start,
          endDate,
          locale,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      track('availability_requested', { listing_id: id, days: duration });
      toast({ tone: 'success', text: t('web.listing.availabilitySent') });
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
      <InlineAlert tone="info">{t('web.listing.availabilityHint')}</InlineAlert>
      <ChipGroup
        label={t('app.availability.from')}
        single
        value={[start]}
        onChange={(v) => v[0] && setStart(v[0])}
        options={days.map((d) => ({
          value: d,
          label: format.dateTime(new Date(`${d}T12:00:00+02:00`), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
        }))}
      />
      <ChipGroup
        label={t('app.availability.duration')}
        single
        value={[String(duration)]}
        onChange={(v) => v[0] && setDuration(Number(v[0]))}
        options={DURATIONS.map((n) => ({
          value: String(n),
          label: t('app.availability.days', { count: n }),
        }))}
      />
      <TextField
        label={t('web.listing.availabilityNote')}
        value={note}
        onChangeText={setNote}
        maxLength={300}
        optional
      />
      <Button block loading={busy} onPress={() => void submit()}>
        {t('web.listing.requestAvailability')}
      </Button>
    </Screen>
  );
}
