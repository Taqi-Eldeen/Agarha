import type { ListingCard as Card } from '@agarha/schemas';
import type { Meta, StoryObj } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, ChipGroup, ContactBar, DealerCard, EmptyState, ErrorState, InlineAlert, ListingCard, ListingCardSkeleton, OTPField, PhoneField, PriceTag, RatingStars, RequirementList, Text, UiProvider } from '../index';

/** Every story renders in Arabic/English × light/dark, like the web Storybook matrix. */
function Matrix({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ gap: 12 }}>
      {(['ar', 'en'] as const).flatMap((locale) =>
        (['light', 'dark'] as const).map((scheme) => (
          <View key={`${locale}-${scheme}`} style={{ minHeight: 120 }}>
            <UiProvider locale={locale} scheme={scheme}>
              <View className="gap-3 bg-page p-4">
                <Text variant="label" tone="secondary">{`${locale} · ${scheme}`}</Text>
                {children}
              </View>
            </UiProvider>
          </View>
        )),
      )}
    </ScrollView>
  );
}

const CARD = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'toyota-corolla-2024',
  photo: null,
  photoCount: 0,
  make: { ar: 'تويوتا', en: 'Toyota' },
  model: { ar: 'كورولا', en: 'Corolla' },
  bodyType: 'sedan',
  year: 2024,
  transmission: 'automatic',
  seats: 5,
  driverOption: 'both',
  prices: { day: 1200, week: 7700, month: null, deposit: 5000 },
  requiredDocs: ['national_id', 'egyptian_driving_licence'],
  minAge: 23,
  kmLimitPerDay: 250,
  airportPickup: true,
  lastConfirmedAt: new Date().toISOString(),
  available: true,
  featured: true,
  dealer: { id: '00000000-0000-4000-8000-000000000002', slug: 'nile', nameAr: 'نايل لتأجير السيارات', nameEn: 'Nile Car Rental', verified: true, whatsapp: '+201000000001', phone: '+201000000001' },
  area: { slug: 'maadi', ar: 'المعادي', en: 'Maadi' },
  city: { slug: 'cairo', ar: 'القاهرة', en: 'Cairo' },
  location: null,
} as Card;

const noop = () => undefined;

const meta = { title: 'Design system', component: Matrix } satisfies Meta<typeof Matrix>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  args: {
    children: (
      <View className="gap-2">
        <Button onPress={noop}>Primary</Button>
        <Button variant="secondary" onPress={noop}>Secondary</Button>
        <Button variant="whatsapp" onPress={noop}>WhatsApp</Button>
        <Button variant="danger" onPress={noop}>Danger</Button>
        <Button loading onPress={noop}>Loading</Button>
        <Button disabled onPress={noop}>Disabled</Button>
      </View>
    ),
  },
};

export const Badges: Story = {
  args: {
    children: (
      <View className="flex-row flex-wrap gap-2">
        <Badge kind="verified" />
        <Badge kind="featured" />
        <Badge kind="fresh" />
        <Badge kind="stale" />
        <Badge kind="driver" />
      </View>
    ),
  },
};

export const Prices: Story = { args: { children: <PriceTag prices={CARD.prices} period="week" showDeposit /> } };

export const Fields: Story = {
  args: {
    children: (
      <View className="gap-4">
        <PhoneField label="Mobile / موبايل" hint="010 1234 5678" />
        <PhoneField label="Mobile / موبايل" error="Enter an Egyptian mobile number" />
        <OTPField label="Code / الكود" value="123" onChange={noop} />
      </View>
    ),
  },
};

export const Chips: Story = { args: { children: <ChipGroup label="Period" single value={['week']} onChange={noop} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} /> } };

export const ListingCards: Story = {
  args: {
    children: (
      <View className="gap-3">
        <ListingCard card={CARD} onPress={noop} onContact={noop} />
        <ListingCard card={{ ...CARD, featured: false, available: false }} variant="map-mini" onPress={noop} />
        <ListingCardSkeleton />
      </View>
    ),
  },
};

export const Dealer: Story = { args: { children: <DealerCard name="Nile Car Rental" verified area="Maadi" reviews={{ count: 18, average: 4.4 }} responseRate={0.92} responseRateLabel="92%" onPress={noop} /> } };

export const Requirements: Story = { args: { children: <RequirementList deposit={5000} minAge={23} requiredDocs={['national_id', 'egyptian_driving_licence']} kmLimitPerDay={250} airportPickup /> } };

export const Contact: Story = { args: { children: <ContactBar prices={CARD.prices} onContact={noop} contacting="whatsapp" /> } };

export const Feedback: Story = {
  args: {
    children: (
      <View className="gap-3">
        <InlineAlert tone="warning" title="Never pay a deposit before seeing the car">Agarha never takes payments.</InlineAlert>
        <EmptyState body="Try another area" />
        <ErrorState body="Could not load" onRetry={noop} requestId="req_123" />
        <RatingStars value={4} onChange={noop} />
      </View>
    ),
  },
};
