'use client';
import { useEffect } from 'react';
import { track } from '@/lib/analytics';

export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => track('listing_viewed', { listing_id: listingId }), [listingId]);
  return null;
}
