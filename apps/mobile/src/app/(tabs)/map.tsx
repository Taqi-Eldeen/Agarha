import { useListing, useMapPins, type SearchParams } from '@agarha/api-client';
import { Button, IconButton, InlineAlert, Text, useUi } from '@agarha/ui-native';
import * as Location from 'expo-location';
import { LocateFixed, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { SearchResultCard } from '@/components/search-result-card';
import { track } from '@/lib/analytics';
import { bboxOf } from '@/lib/geo';

const CAIRO: Region = { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.25, longitudeDelta: 0.25 };

export default function MapTab() {
  const t = useTranslations('app.map');
  const tu = useTranslations('ui');
  const { colors, egp } = useUi();
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(CAIRO);
  const [query, setQuery] = useState<SearchParams>({ bbox: bboxOf(CAIRO) });
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const pins = useMapPins(query);
  const detail = useListing(selected ?? undefined);

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return setDenied(true);
    setDenied(false);
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    map.current?.animateToRegion(next, 400);
    setQuery({ bbox: bboxOf(next) });
    track('map_located');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-page">
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={CAIRO}
        onRegionChangeComplete={(r) => {
          setRegion(r);
          setMoved(true);
        }}
        showsUserLocation
        accessibilityLabel={t('searchHere')}
      >
        {(pins.data ?? []).map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => setSelected(p.id)} accessibilityLabel={egp(p.price)}>
            <View className={p.featured ? 'rounded-full bg-featured px-2 py-1' : 'rounded-full bg-brand px-2 py-1'}>
              <Text variant="caption" weight="semibold" tone="inherit" style={{ color: p.featured ? colors.accentOnFeatured : '#FFFFFF' }}>
                {egp(p.price)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
      <View pointerEvents="box-none" className="absolute inset-x-0 top-14 items-center gap-2 px-4">
        {moved ? (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              setQuery({ bbox: bboxOf(region) });
              setMoved(false);
              track('map_search_area');
            }}
          >
            {t('searchHere')}
          </Button>
        ) : null}
        {denied ? <InlineAlert tone="warning">{t('permissionDenied')}</InlineAlert> : null}
      </View>
      <View className="absolute bottom-4 gap-2 px-4" style={{ end: 0 }}>
        <IconButton label={t('locate')} variant="secondary" className="rounded-full" icon={<LocateFixed size={22} color={colors.textPrimary} strokeWidth={1.75} />} onPress={() => void locate()} />
      </View>
      {selected && detail.data ? (
        <View className="absolute inset-x-0 bottom-20 flex-row items-start gap-2 px-4">
          <View className="flex-1">
            <SearchResultCard card={detail.data.card} source="map" variant="map-mini" />
          </View>
          <IconButton label={tu('close')} variant="secondary" className="rounded-full" icon={<X size={20} color={colors.textPrimary} strokeWidth={1.75} />} onPress={() => setSelected(null)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
