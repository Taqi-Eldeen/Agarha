import { LEGAL_DOCS, LEGAL_UPDATED, legalDoc, type LegalDoc } from '@agarha/i18n';
import { InlineAlert, Text } from '@agarha/ui-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { useLocale } from '@/lib/i18n';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const t = useTranslations('web.legal');
  const { locale } = useLocale();
  const d: LegalDoc = LEGAL_DOCS.includes(doc as LegalDoc) ? (doc as LegalDoc) : 'terms';
  const title = t(d === 'dealer-terms' ? 'dealerTerms' : d);
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      <Text variant="h1" accessibilityRole="header">{title}</Text>
      <InlineAlert tone="info">{`${t('draftNotice')} · ${LEGAL_UPDATED}`}</InlineAlert>
      {legalDoc(d, locale).map((s) => (
        <View key={s.h} className="gap-2">
          <Text variant="h2">{s.h}</Text>
          {s.p.map((p) => (
            <Text key={p}>{p}</Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}
