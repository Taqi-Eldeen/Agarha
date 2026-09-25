'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { useQuery } from '@tanstack/react-query';

export interface DealerMe {
  dealer: { id: string; slug: string; status: 'onboarding' | 'pending_review' | 'verified' | 'rejected' | 'suspended'; displayNameAr: string; displayNameEn: string; legalName: string; phoneE164: string; whatsappE164: string; descriptionAr: string | null; descriptionEn: string | null; suspendedAt: string | null };
  branches: { id: string; areaId: string; nameAr: string; nameEn: string; addressAr: string | null; addressEn: string | null; isPrimary: boolean; lat: number | null; lng: number | null }[];
  documents: { items: { type: string; status: string; rejectionReason: string | null }[]; requiredUploaded: boolean };
  steps: { business: boolean; branches: boolean; documents: boolean; review: boolean };
  canSubmit: boolean;
  role: 'dealer_owner' | 'dealer_staff';
  limits: { planCode: string; maxLiveListings: number | null; maxTeamMembers: number; featuredCreditsRemaining: number };
}

/** null data = signed in but no dealer yet (onboarding). Error 401 = signed out. */
export function useDealerMe() {
  const api = useApi();
  return useQuery({
    queryKey: ['dealer-me'],
    retry: false,
    queryFn: async () => {
      try {
        return (await api.GET('/v1/dealer/me')).data as unknown as DealerMe;
      } catch (e) {
        if ((e as ApiRequestError).status === 403) return null;
        throw e;
      }
    },
  });
}

export const isSignedOut = (e: unknown) => (e as ApiRequestError | null)?.status === 401;
