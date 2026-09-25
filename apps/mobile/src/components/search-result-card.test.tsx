import type { ListingCard } from '@agarha/schemas';
import { ToastProvider, UiProvider } from '@agarha/ui-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SearchResultCard } from './search-result-card';

const mockPush = jest.fn();
const mockMutateAsync = jest.fn(async () => ({
  refCode: 'AG-7K2M',
  url: 'https://wa.me/201000000001?text=Ref%20AG-7K2M',
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@agarha/api-client', () => ({
  useContactDealer: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock('@/lib/i18n', () => ({ useLocale: () => ({ locale: 'ar', setLocale: jest.fn() }) }));
jest.mock('use-intl', () => ({ useTranslations: () => (k: string) => k }));

const CARD = {
  id: '3f2b8c1e-7d4a-4c1b-9e2f-0a1b2c3d4e5f',
  slug: 'hyundai-elantra-2023',
  photo: null,
  photoCount: 0,
  make: { ar: 'هيونداي', en: 'Hyundai' },
  model: { ar: 'إلنترا', en: 'Elantra' },
  bodyType: 'sedan',
  year: 2023,
  transmission: 'automatic',
  seats: 5,
  driverOption: 'self',
  prices: { day: 1100, week: null, month: null, deposit: 3000 },
  requiredDocs: ['national_id'],
  minAge: 21,
  kmLimitPerDay: 250,
  airportPickup: false,
  lastConfirmedAt: new Date().toISOString(),
  available: true,
  featured: false,
  dealer: {
    id: '00000000-0000-4000-8000-000000000009',
    slug: 'delta',
    nameAr: 'دلتا',
    nameEn: 'Delta',
    verified: true,
    whatsapp: '+201000000001',
    phone: '+201000000001',
  },
  area: { slug: 'nasr-city', ar: 'مدينة نصر', en: 'Nasr City' },
  city: { slug: 'cairo', ar: 'القاهرة', en: 'Cairo' },
  location: null,
} as ListingCard;

const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <UiProvider locale="ar">
      <ToastProvider>{children}</ToastProvider>
    </UiProvider>
  </SafeAreaProvider>
);

it('logs the lead then opens WhatsApp with the reference code; tapping the card opens the listing', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await render(<SearchResultCard card={CARD} source="search" />, { wrapper });
  await fireEvent.press(screen.getByRole('button', { name: 'واتساب' }));
  expect(mockMutateAsync).toHaveBeenCalledWith({
    listingId: CARD.id,
    channel: 'whatsapp',
    locale: 'ar',
  });
  expect(open).toHaveBeenCalledWith(expect.stringContaining('AG-7K2M'));
  await fireEvent.press(screen.getByRole('link', { name: 'هيونداي إلنترا 2023' }));
  expect(mockPush).toHaveBeenCalledWith(`/cars/${CARD.id}`);
});
