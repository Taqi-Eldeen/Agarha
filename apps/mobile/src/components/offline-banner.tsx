import { InlineAlert } from '@agarha/ui-native';
import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';

/** Keeps TanStack Query's online state in sync with the device and shows a banner while offline. */
export function OfflineBanner() {
  const t = useTranslations('app');
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sub = Network.addNetworkStateListener((s) => {
      const on = s.isConnected !== false && s.isInternetReachable !== false;
      onlineManager.setOnline(on);
      setOnline(on);
    });
    return () => sub.remove();
  }, []);
  if (online) return null;
  return (
    <View className="px-4 pt-2">
      <InlineAlert tone="warning">{t('offline')}</InlineAlert>
    </View>
  );
}
