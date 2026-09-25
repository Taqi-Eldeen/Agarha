import '../../global.css';
import { ApiProvider } from '@agarha/api-client';
import { ToastProvider, UiProvider, useUi } from '@agarha/ui-native';
// Per-weight imports: only the 7 faces we use are bundled, not whole families.
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { OfflineBanner } from '@/components/offline-banner';
import { api } from '@/lib/api';
import { LocaleProvider, useLocale } from '@/lib/i18n';
import { usePushNavigation } from '@/lib/push';
import { SessionProvider } from '@/lib/session';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

// Refetch stale data when the app comes back to the foreground.
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

export default function RootLayout() {
  const [fonts] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, Rubik_600SemiBold });
  if (!fonts) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>
          <LocaleProvider>
            <Themed />
          </LocaleProvider>
        </ApiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Themed() {
  const { locale } = useLocale();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  useEffect(() => void SplashScreen.hideAsync(), []);
  return (
    <UiProvider locale={locale} scheme={scheme}>
      <ToastProvider>
        <SessionProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <OfflineBanner />
          <RootStack />
        </SessionProvider>
      </ToastProvider>
    </UiProvider>
  );
}

function RootStack() {
  const { colors, locale } = useUi();
  const t = useTranslations();
  usePushNavigation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceCard },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: locale === 'ar' ? 'IBMPlexSansArabic_600SemiBold' : 'IBMPlexSans_600SemiBold' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.surfacePage },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ title: t('web.search.title') }} />
      <Stack.Screen name="cars/[id]" options={{ title: '' }} />
      <Stack.Screen name="dealers/[slug]" options={{ title: '' }} />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t('common.signIn') }} />
      <Stack.Screen name="report/[id]" options={{ presentation: 'modal', title: t('web.report.title') }} />
      <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
    </Stack>
  );
}
