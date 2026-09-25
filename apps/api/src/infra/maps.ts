// Maps provider port (Google vs Mapbox is still open, section 4). Geocodes are cached in Redis
// for 30 days to keep spend down (risk #7); every paid call increments a spend counter.
import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import type Redis from 'ioredis';
import { ENV, type Env } from '../config/env';
import { sha256 } from '../common/crypto';
import { REDIS } from './redis/redis';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}
export interface MapsProvider {
  readonly name: string;
  geocode(address: string, locale: 'ar' | 'en'): Promise<GeocodeResult | null>;
}

class GoogleMaps implements MapsProvider {
  readonly name = 'google';
  constructor(private readonly key: string) {}
  async geocode(address: string, locale: 'ar' | 'en') {
    const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    u.search = new URLSearchParams({ address, key: this.key, language: locale, region: 'eg', components: 'country:EG' }).toString();
    const r = (await (await fetch(u, { signal: AbortSignal.timeout(5000) })).json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
    const f = r.results?.[0];
    return f ? { lat: f.geometry.location.lat, lng: f.geometry.location.lng, formatted: f.formatted_address } : null;
  }
}

class Mapbox implements MapsProvider {
  readonly name = 'mapbox';
  constructor(private readonly token: string) {}
  async geocode(address: string, locale: 'ar' | 'en') {
    const u = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    u.search = new URLSearchParams({ q: address, access_token: this.token, language: locale, country: 'eg', limit: '1' }).toString();
    const r = (await (await fetch(u, { signal: AbortSignal.timeout(5000) })).json()) as { features?: { geometry: { coordinates: [number, number] }; properties: { full_address?: string; name: string } }[] };
    const f = r.features?.[0];
    return f ? { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], formatted: f.properties.full_address ?? f.properties.name } : null;
  }
}

/** Deterministic mock: places every address near central Cairo, offset by a hash of the text. */
export class MockMaps implements MapsProvider {
  readonly name = 'mock';
  async geocode(address: string) {
    const h = parseInt(sha256(address).slice(0, 8), 16);
    return { lat: 30.0444 + ((h % 1000) - 500) / 10_000, lng: 31.2357 + (((h >> 10) % 1000) - 500) / 10_000, formatted: address };
  }
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger('Maps');
  readonly provider: MapsProvider;
  constructor(
    @Inject(ENV) env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion -- env validation requires the key for the chosen provider */
    this.provider = env.MAPS_PROVIDER === 'google' ? new GoogleMaps(env.GOOGLE_MAPS_API_KEY!) : env.MAPS_PROVIDER === 'mapbox' ? new Mapbox(env.MAPBOX_ACCESS_TOKEN!) : new MockMaps();
  }

  async geocode(address: string, locale: 'ar' | 'en'): Promise<GeocodeResult | null> {
    const key = `geo:${this.provider.name}:${locale}:${sha256(address.trim().toLowerCase())}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as GeocodeResult | null;
    try {
      const r = await this.provider.geocode(address, locale);
      await this.redis.multi().set(key, JSON.stringify(r), 'EX', 30 * 86_400).incr(`maps:spend:${new Date().toISOString().slice(0, 7)}`).exec();
      return r;
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'geocode failed');
      return null;
    }
  }

  /** Paid geocode calls this month; exported as a metric for the spend alert. */
  async monthlyCalls(): Promise<number> {
    return Number((await this.redis.get(`maps:spend:${new Date().toISOString().slice(0, 7)}`)) ?? 0);
  }
}

@Global()
@Module({ providers: [MapsService], exports: [MapsService] })
export class MapsModule {}
