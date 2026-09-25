import { useApi, useMe } from '@agarha/api-client';
import { formatPhone } from '@agarha/i18n';
import { Button, ChipGroup, InlineAlert, Modal, Text, useToast, useUi } from '@agarha/ui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as StoreReview from 'expo-store-review';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { webOrigin } from '@/lib/env';
import { useLocale } from '@/lib/i18n';
import { registerPush, type PushState } from '@/lib/push';
import { useSession } from '@/lib/session';

const TOPICS = ['reviews', 'saved_searches', 'availability'] as const;
type Pref = { topic: string; channel: string; enabled: boolean };

export default function Account() {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { colors } = useUi();
  const router = useRouter();
  const { signedIn, signOut } = useSession();
  const me = useMe(!!signedIn);

  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header">{t('web.account.title')}</Text>
      {signedIn ? (
        me.data ? <Text tone="secondary">{t('web.account.signedInAs', { phone: formatPhone(me.data.phone) })}</Text> : null
      ) : (
        <View className="gap-3 rounded-lg border border-border bg-card p-4">
          <Text weight="semibold">{t('web.account.signInTitle')}</Text>
          <Text tone="secondary">{t('web.account.signInBody')}</Text>
          <Button onPress={() => router.push('/sign-in')}>{t('common.signIn')}</Button>
        </View>
      )}

      <View className="gap-2">
        <Text variant="h2">{t('app.account.language')}</Text>
        <ChipGroup label={t('app.account.language')} single value={[locale]} onChange={(v) => v[0] && v[0] !== locale && void setLocale(v[0] as 'ar' | 'en')} options={[{ value: 'ar', label: t('app.onboarding.arabic') }, { value: 'en', label: t('app.onboarding.english') }]} />
        <Text variant="caption" tone="secondary">{t('app.account.languageRestart')}</Text>
      </View>

      {signedIn ? <Notifications /> : null}

      <View className="gap-1">
        <Row label={t('web.legal.terms')} onPress={() => router.push('/legal/terms')} color={colors.textSecondary} />
        <Row label={t('web.legal.privacy')} onPress={() => router.push('/legal/privacy')} color={colors.textSecondary} />
        <Row label={t('web.nav.help')} onPress={() => void Linking.openURL(`${webOrigin()}/${locale}/help`)} color={colors.textSecondary} />
        <Row label={t('app.account.rate')} onPress={() => void StoreReview.requestReview()} color={colors.textSecondary} />
      </View>

      {signedIn ? <DataControls onSignOut={signOut} /> : null}
      <Text variant="caption" tone="secondary" className="text-center">{t('app.account.version', { version: `${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '1'})` })}</Text>
    </Screen>
  );
}

function Row({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  const { dir } = useUi();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-touch flex-row items-center justify-between border-b border-border">
      <Text>{label}</Text>
      <View style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }}>
        <ChevronRight size={20} color={color} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}

function Notifications() {
  const t = useTranslations('app.account');
  const api = useApi();
  const qc = useQueryClient();
  const { locale } = useLocale();
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => void registerPush(locale, false).then(setPush).catch(() => setPush('unsupported')), [locale]);
  const prefs = useQuery({ queryKey: ['notification-preferences'], queryFn: async () => ((await api.GET('/v1/me/notification-preferences')).data as unknown as { preferences: Pref[] }).preferences });
  const enabled = (topic: string) => prefs.data?.find((p) => p.topic === topic && p.channel === 'push')?.enabled ?? true;
  const set = async (topic: (typeof TOPICS)[number], on: boolean) => {
    if (on && push !== 'granted') setPush(await registerPush(locale, true));
    await api.PUT('/v1/me/notification-preferences', { body: { preferences: [{ topic, channel: 'push', enabled: on }] } });
    await qc.invalidateQueries({ queryKey: ['notification-preferences'] });
  };
  return (
    <View className="gap-2">
      <Text variant="h2">{t('notifications')}</Text>
      {push === 'denied' ? (
        <InlineAlert tone="info" action={<Button size="sm" variant="ghost" onPress={() => void Linking.openSettings()}>{t('openSettings')}</Button>}>
          {t('pushOff')}
        </InlineAlert>
      ) : null}
      {TOPICS.map((topic) => (
        <View key={topic} className="min-h-touch flex-row items-center justify-between">
          <Text>{t(`pushTopics.${topic}`)}</Text>
          <Switch accessibilityLabel={t(`pushTopics.${topic}`)} value={enabled(topic)} onValueChange={(v) => void set(topic, v)} />
        </View>
      ))}
    </View>
  );
}

function DataControls({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const t = useTranslations();
  const api = useApi();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    setBusy(true);
    try {
      const { data } = await api.GET('/v1/me/export');
      const file = new File(Paths.cache, 'agarha-my-data.json');
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      toast({ tone: 'success', text: t('app.account.exportSent') });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    } catch {
      toast({ tone: 'danger', text: t('errors.internal_error') });
    } finally {
      setBusy(false);
    }
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.DELETE('/v1/me');
      setConfirm(false);
      await onSignOut();
      toast({ tone: 'success', text: t('web.account.deleted') });
    } catch {
      toast({ tone: 'danger', text: t('errors.internal_error') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text weight="semibold">{t('web.account.exportTitle')}</Text>
        <Text variant="caption" tone="secondary">{t('web.account.exportBody')}</Text>
        <Button variant="secondary" loading={busy && !confirm} onPress={() => void exportData()}>
          {t('web.account.exportButton')}
        </Button>
      </View>
      <View className="gap-2">
        <Text weight="semibold">{t('web.account.deleteTitle')}</Text>
        <Text variant="caption" tone="secondary">{t('web.account.deleteBody')}</Text>
        <Button variant="danger" onPress={() => setConfirm(true)}>
          {t('web.account.deleteButton')}
        </Button>
      </View>
      <Button variant="ghost" onPress={() => void onSignOut()}>
        {t('common.signOut')}
      </Button>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t('web.account.deleteTitle')}
        footer={
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="secondary" onPress={() => setConfirm(false)}>
              {t('ui.close')}
            </Button>
            <Button className="flex-1" variant="danger" loading={busy} onPress={() => void deleteAccount()}>
              {t('web.account.deleteButton')}
            </Button>
          </View>
        }
      >
        <Text>{t('web.account.deleteConfirm')}</Text>
      </Modal>
    </View>
  );
}
