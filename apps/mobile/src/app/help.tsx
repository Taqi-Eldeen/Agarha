import { InlineAlert, Text } from '@agarha/ui-native';
import { Linking, Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';

const FAQ = [1, 2, 3, 4, 5, 6] as const;
const SAFETY = [1, 2, 3, 4] as const;

export default function Help() {
  const t = useTranslations('web.help');
  return (
    <Screen edges={['bottom']}>
      <View className="gap-3">
        <Text variant="h2">{t('safetyTitle')}</Text>
        {SAFETY.map((n) => (
          <InlineAlert key={n} tone={n === 1 ? 'warning' : 'info'}>
            {t(`safety.s${n}`)}
          </InlineAlert>
        ))}
      </View>
      <View className="gap-4">
        <Text variant="h2">{t('faqTitle')}</Text>
        {FAQ.map((n) => (
          <View key={n} className="gap-1">
            <Text weight="semibold" accessibilityRole="header">
              {t(`faq.q${n}`)}
            </Text>
            <Text tone="secondary">{t(`faq.a${n}`)}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL('mailto:support@agarha.com')}
        className="min-h-touch justify-center"
      >
        <Text tone="brand">{t('contact')}</Text>
      </Pressable>
    </Screen>
  );
}
