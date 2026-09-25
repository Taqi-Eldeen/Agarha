'use client';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { useUi } from '../lib/ui-context';

export interface MapPinData {
  id: string;
  lat: number;
  lng: number;
  price: number;
  featured: boolean;
}

export interface MapViewProps {
  pins: MapPinData[];
  /** Map style URL from the chosen provider (Mapbox / MapTiler / Google via MapLibre). */
  styleUrl: string;
  /** Where the app serves maplibre's module worker (apps/web/scripts/copy-vendor.mjs). */
  workerUrl?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Fires after the user pans/zooms: [minLng, minLat, maxLng, maxLat] for "search this area". */
  onMoveEnd?: (bbox: [number, number, number, number]) => void;
  className?: string;
}

/**
 * Clustered map (MapLibre GL). Loaded on demand only (risk #7: maps cost) — import from
 * '@agarha/ui-web/map' with next/dynamic so the library never ships with the listing page.
 * Pins = circles with the price label; clusters show a count and zoom in on click.
 */
export default function MapView({
  pins,
  styleUrl,
  workerUrl = '/vendor/maplibre/maplibre-gl-worker.mjs',
  center = { lat: 30.0444, lng: 31.2357 },
  zoom = 11,
  selectedId,
  onSelect,
  onMoveEnd,
  className,
}: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const { t, locale } = useUi();
  // Latest pins for the 'load' handler: pins usually arrive before the style finishes loading.
  const latest = useRef({ pins, selectedId });
  latest.current = { pins, selectedId };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const maplibre = await import('maplibre-gl');
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !el.current) return;
      const m = new maplibre.Map({
        container: el.current,
        style: styleUrl,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        locale: { 'NavigationControl.ZoomIn': t.zoomIn, 'NavigationControl.ZoomOut': t.zoomOut },
      });
      map.current = m;
      // If the basemap style can't be fetched (offline, provider outage), fall back to a plain style
      // so the price pins still render; they are the point of the map.
      let styled = false;
      const fallback = () => {
        if (!styled && !cancelled) m.setStyle(FALLBACK_STYLE);
        styled = true;
      };
      m.once('style.load', () => void (styled = true));
      m.on('error', (e) => {
        // Tile errors carry a sourceId; a style/network failure before the style loads does not.
        if (!('sourceId' in e)) fallback();
      });
      setTimeout(fallback, 10_000);
      m.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        locale === 'ar' ? 'top-left' : 'top-right',
      );
      // Pins go in as soon as the style is parsed ('style.load'), not after every basemap tile has
      // loaded ('load'): on a slow connection the prices show up before the streets do.
      m.on('style.load', () => {
        if (m.getSource('pins')) return;
        m.addSource('pins', {
          type: 'geojson',
          data: toGeoJson(latest.current.pins, latest.current.selectedId),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 14,
        });
        m.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'pins',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#0F6E68',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        m.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'pins',
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 14 },
          paint: { 'text-color': '#ffffff' },
        });
        m.addLayer({
          id: 'pin',
          type: 'circle',
          source: 'pins',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['get', 'featured'], '#F2A900', '#0F6E68'],
            'circle-radius': 9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        m.addLayer({
          id: 'pin-label',
          type: 'symbol',
          source: 'pins',
          filter: ['!', ['has', 'point_count']],
          layout: { 'text-field': ['get', 'label'], 'text-offset': [0, 1.4], 'text-size': 12 },
          paint: { 'text-color': '#16202B', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
        });
        m.on('click', 'clusters', async (e) => {
          const f = e.features?.[0];
          const src = m.getSource('pins') as GeoJSONSource;
          if (!f) return;
          const z = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
          m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: z });
        });
        m.on('click', 'pin', (e) => {
          const id = e.features?.[0]?.properties.id as string | undefined;
          if (id) onSelect?.(id);
        });
        for (const layer of ['clusters', 'pin']) {
          m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        }
      });
      m.on('moveend', () => {
        const b = m.getBounds();
        onMoveEnd?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      });
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Recreate only when the style changes; pins update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pins/selection update in the effect below
  }, [styleUrl]);

  useEffect(() => {
    const src = map.current?.getSource('pins') as GeoJSONSource | undefined;
    src?.setData(toGeoJson(pins, selectedId));
  }, [pins, selectedId]);

  return (
    <div
      ref={el}
      role="region"
      aria-label={t.map}
      className={className ?? 'h-full min-h-80 w-full rounded-lg'}
    />
  );
}

const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': '#E2F1EF' } },
  ],
};

function toGeoJson(pins: MapPinData[], selectedId?: string | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        featured: p.featured || p.id === selectedId,
        label: `${p.price.toLocaleString('en')} EGP`,
      },
    })),
  };
}
