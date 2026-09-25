import type { SearchQuery } from './search.schemas';

export interface SearchDocument {
  listingId: string;
  dealerId: string;
  available: boolean;
  citySlug: string;
  areaSlug: string;
  bodyType: string;
  makeSlug: string;
  modelSlug: string;
  transmission: string;
  fuel: string;
  seats: number;
  year: number;
  driverOption: string;
  airportPickup: boolean;
  priceDay: number;
  priceWeek: number;
  priceMonth: number;
  deposit: number;
  featuredUntil: Date | null;
  lastConfirmedAt: Date;
  publishedAt: Date;
  lat: number | null;
  lng: number | null;
  searchText: string;
  card: ListingCard;
}

/** What every results list / map pin / favorite renders (section 9, listing card anatomy). */
export interface ListingCard {
  id: string;
  slug: string;
  photo: { url320: string | null; url640: string | null; blurhash: string | null } | null;
  photoCount: number;
  make: { ar: string; en: string };
  model: { ar: string; en: string };
  bodyType: string;
  year: number;
  transmission: string;
  seats: number;
  driverOption: string;
  prices: { day: number; week: number | null; month: number | null; deposit: number };
  requiredDocs: string[];
  minAge: number;
  kmLimitPerDay: number | null;
  airportPickup: boolean;
  lastConfirmedAt: string;
  available: boolean;
  featured: boolean;
  dealer: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    verified: boolean;
    whatsapp: string;
    phone: string;
  };
  area: { slug: string; ar: string; en: string };
  city: { slug: string; ar: string; en: string };
  location: { lat: number; lng: number } | null;
}

export interface SearchHit {
  card: ListingCard;
  distanceKm?: number;
}

export interface SearchResult {
  items: SearchHit[];
  nextCursor: string | null;
  total: number;
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  price: number;
  featured: boolean;
}

/** Search engine port. Postgres now; Meilisearch/Typesense behind a feature flag (P6). */
export interface SearchEngine {
  readonly name: string;
  upsert(doc: SearchDocument): Promise<void>;
  remove(listingId: string): Promise<void>;
  search(q: SearchQuery, now: Date): Promise<SearchResult>;
  pins(q: SearchQuery): Promise<MapPin[]>;
  /** Listings published after `since` matching `q` (saved-search alerts). */
  newSince(q: SearchQuery, since: Date): Promise<string[]>;
}
export const SEARCH_ENGINES = Symbol('SEARCH_ENGINES');
