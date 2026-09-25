import type { Locale } from '@agarha/schemas';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api';
import { webPathToAppPath } from './links';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushState = 'granted' | 'denied' | 'unsupported';

/** Asks once (after sign-in, never on first launch) and registers the Expo push token with the API. */
export async function registerPush(locale: Locale, ask = true): Promise<PushState> {
  if (!Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Agarha', importance: Notifications.AndroidImportance.DEFAULT });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return 'unsupported';
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.POST('/v1/me/push-tokens', { body: { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale } });
  return 'granted';
}

/** Taps on a notification (warm or cold start) open the linked screen. Payloads carry a web URL. */
export function usePushNavigation() {
  const router = useRouter();
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = last?.notification.request.content.data?.url;
    const path = typeof url === 'string' ? webPathToAppPath(url) : null;
    if (path) router.push(path as never);
  }, [last, router]);
}
