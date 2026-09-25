import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import RNMapView, { Marker, type Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export interface MapPinData {
  id: string;
  lat: number;
  lng: number;
  price: number;
  featured: boolean;
}

export type MapItem =
  | ({ kind: 'pin' } & MapPinData)
  | { kind: 'cluster'; id: string; lat: number; lng: number; count: number; zoomTo: Region };

/** Region → web-map zoom level (longitude span of 360° at zoom 0). */
export function zoomOf(region: Region): number {
  return Math.max(
    0,
    Math.min(20, Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 1e-6)))),
  );
}

/**
 * Groups pins that would overlap at the current zoom (supercluster, 60px radius). Clusters carry the
 * region to zoom into when tapped. Pure, so it is unit-tested without a map.
 */
export function clusterPins(pins: MapPinData[], region: Region): MapItem[] {
  const index = new Supercluster<MapPinData, Record<string, never>>({ radius: 60, maxZoom: 16 });
  index.load(
    pins.map((p) => ({
      type: 'Feature',
      properties: p,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  );
  const bbox: [number, number, number, number] = [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
  return index.getClusters(bbox, zoomOf(region)).map((f) => {
    const [lng, lat] = f.geometry.coordinates as [number, number];
    if ('cluster' in f.properties && f.properties.cluster) {
      const id = f.properties.cluster_id as number;
      const z = Math.min(index.getClusterExpansionZoom(id), 18);
      const span = 360 / 2 ** z;
      return {
        kind: 'cluster',
        id: `c${id}`,
        lat,
        lng,
        count: f.properties.point_count as number,
        zoomTo: { latitude: lat, longitude: lng, latitudeDelta: span, longitudeDelta: span },
      };
    }
    return { kind: 'pin', ...(f.properties as MapPinData) };
  });
}

/** Price pin. Featured pins use the sun-yellow accent (always with text/primary on it). */
export function Pin({
  price,
  featured,
  selected,
}: {
  price: number;
  featured: boolean;
  selected?: boolean;
}) {
  const { egp, colors, scheme } = useUi();
  return (
    <View
      className={cn(
        'rounded-full border-2 px-2 py-1',
        featured ? 'bg-featured' : selected ? 'bg-brand-pressed' : 'bg-brand',
        selected ? 'border-fg' : 'border-card',
      )}
    >
      <Text
        variant="caption"
        weight="semibold"
        tone="inherit"
        style={{
          color: featured
            ? colors.accentOnFeatured
            : scheme === 'light'
              ? '#FFFFFF'
              : colors.surfacePage,
        }}
      >
        {egp(price)}
      </Text>
    </View>
  );
}

export function Cluster({ count }: { count: number }) {
  const { colors } = useUi();
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brandPrimary,
        borderWidth: 2,
      }}
      className="items-center justify-center"
    >
      <Text weight="semibold" tone="brand">
        {String(count)}
      </Text>
    </View>
  );
}

export interface MapViewProps {
  pins: MapPinData[];
  region: Region;
  onRegionChangeComplete: (r: Region) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  showsUserLocation?: boolean;
  children?: ReactNode;
}

/** Map with clustered price pins (react-native-maps: Apple Maps on iOS, Google Maps on Android). */
export const MapView = forwardRef<RNMapView, MapViewProps>(function MapView(
  { pins, region, onRegionChangeComplete, selectedId, onSelect, showsUserLocation, children },
  ref,
) {
  const { t, f, egp, scheme } = useUi();
  const items = useMemo(() => clusterPins(pins, region), [pins, region]);
  const inner = useRef<RNMapView>(null);
  useImperativeHandle(ref, () => inner.current as RNMapView);
  return (
    <RNMapView
      ref={inner}
      style={{ flex: 1 }}
      initialRegion={region}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation={showsUserLocation}
      userInterfaceStyle={scheme}
      accessibilityLabel={t.map}
    >
      {items.map((it) =>
        it.kind === 'cluster' ? (
          <Marker
            key={it.id}
            coordinate={{ latitude: it.lat, longitude: it.lng }}
            accessibilityLabel={f('clusterCount', { count: it.count })}
            onPress={() => inner.current?.animateToRegion(it.zoomTo, 300)}
            tracksViewChanges={false}
          >
            <Cluster count={it.count} />
          </Marker>
        ) : (
          <Marker
            key={it.id}
            coordinate={{ latitude: it.lat, longitude: it.lng }}
            accessibilityLabel={egp(it.price)}
            onPress={() => onSelect?.(it.id)}
            tracksViewChanges={it.id === selectedId}
          >
            <Pin price={it.price} featured={it.featured} selected={it.id === selectedId} />
          </Marker>
        ),
      )}
      {children}
    </RNMapView>
  );
});
