import { useUi } from '@agarha/ui-native';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Compass, Heart, Map, UserRound } from 'lucide-react-native';
import { useTranslations } from 'use-intl';
import { prefs } from '@/lib/storage';

export default function TabsLayout() {
  const t = useTranslations('app.tabs');
  const { colors, locale } = useUi();
  const fontFamily = locale === 'ar' ? 'IBMPlexSansArabic_500Medium' : 'IBMPlexSans_500Medium';
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => void prefs.get('onboarded', false).then(setOnboarded), []);
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surfaceCard, borderTopColor: colors.borderDefault },
        tabBarLabelStyle: { fontFamily, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('explore'), tabBarIcon: ({ color }) => <Compass size={24} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="map" options={{ title: t('map'), tabBarIcon: ({ color }) => <Map size={24} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="saved" options={{ title: t('saved'), tabBarIcon: ({ color }) => <Heart size={24} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="account" options={{ title: t('account'), tabBarIcon: ({ color }) => <UserRound size={24} color={color} strokeWidth={1.75} /> }} />
    </Tabs>
  );
}
