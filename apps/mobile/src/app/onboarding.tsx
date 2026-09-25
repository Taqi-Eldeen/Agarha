import { Button, Text } from '@agarha/ui-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { track } from '@/lib/analytics';
import { useLocale } from '@/lib/i18n';
import { prefs } from '@/lib/storage';

/** First launch: language, then an optional, explained location permission. Never blocks browsing. */
export default function Onboarding() {
  const t = useTranslations('app.onboarding');
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<'language' | 'location'>('language');
  const finish = async (location: 'granted' | 'skipped' | 'denied') => {
    await prefs.set('onboarded', true);
    track('onboarding_completed', { locale, location });
    router.replace('/');
  };
  return (
    <Screen edges={['top', 'bottom']} contentContainerClassName="flex-1 justify-center gap-6 px-4">
      {step === 'language' ? (
        <View className="gap-4">
          <Text variant="h1" accessibilityRole="header">
            {t('languageTitle')}
          </Text>
          <Button
            size="lg"
            variant={locale === 'ar' ? 'primary' : 'secondary'}
            onPress={() => void setLocale('ar').then(() => setStep('location'))}
          >
            {t('arabic')}
          </Button>
          <Button
            size="lg"
            variant={locale === 'en' ? 'primary' : 'secondary'}
            onPress={() => void setLocale('en').then(() => setStep('location'))}
          >
            {t('english')}
          </Button>
        </View>
      ) : (
        <View className="gap-4">
          <Text variant="h1" accessibilityRole="header">
            {t('locationTitle')}
          </Text>
          <Text tone="secondary">{t('locationBody')}</Text>
          <Button
            size="lg"
            onPress={async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              await finish(status === 'granted' ? 'granted' : 'denied');
            }}
          >
            {t('allow')}
          </Button>
          <Button size="lg" variant="ghost" onPress={() => void finish('skipped')}>
            {t('notNow')}
          </Button>
        </View>
      )}
    </Screen>
  );
}
