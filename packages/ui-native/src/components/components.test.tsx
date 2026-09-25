import type { ListingCard as Card } from '@agarha/schemas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Badge, Button, ChipGroup, ContactBar, EmptyState, FreshnessChip, hexToChannels, ListingCard, OTPField, PhoneField, PriceTag, RatingStars, RequirementList, themeVars, UiProvider } from '../index';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (locale: 'ar' | 'en', scheme: 'light' | 'dark' = 'light') =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <UiProvider locale={locale} scheme={scheme}>
          {children}
        </UiProvider>
      </SafeAreaProvider>
    );
  };

const CARD: Card = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'toyota-corolla-2024',
  make: { ar: 'تويوتا', en: 'Toyota' },
  model: { ar: 'كورولا', en: 'Corolla' },
  year: 2024,
  transmission: 'automatic',
  bodyType: 'sedan',
  seats: 5,
  driverOption: 'self',
  prices: { day: 1200, week: 7700, month: null, deposit: 5000 },
  minAge: 23,
  requiredDocs: ['national_id', 'egyptian_driving_licence'],
  available: true,
  lastConfirmedAt: '2026-09-20T08:00:00Z',
  featured: true,
  photo: null,
  area: { ar: 'المعادي', en: 'Maadi' },
  city: { ar: 'القاهرة', en: 'Cairo' },
  dealer: { id: '00000000-0000-4000-8000-000000000002', slug: 'nile-rentals', nameAr: 'نايل', nameEn: 'Nile Rentals', verified: true },
} as unknown as Card;

describe('tokens → NativeWind vars', () => {
  it('converts hex to the rgb channel triple the preset expects', async () => {
    expect(hexToChannels('#0F6E68')).toBe('15 110 104');
  });
  it('switches every colour variable between light and dark', async () => {
    const light = themeVars('light');
    const dark = themeVars('dark');
    expect(Object.keys(light)).toHaveLength(14);
    expect(light['--ag-color-brand-primary']).not.toBe(dark['--ag-color-brand-primary']);
  });
});

describe('Button', () => {
  it('fires onPress and exposes the button role', async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Save</Button>, { wrapper: wrap('en') });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('is disabled and busy while loading', async () => {
    const onPress = jest.fn();
    await render(<Button loading onPress={onPress}>Save</Button>, { wrapper: wrap('en') });
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn.props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe('PriceTag', () => {
  it('uses the explicit weekly price and the period suffix (en)', async () => {
    await render(<PriceTag prices={CARD.prices} period="week" showDeposit />, { wrapper: wrap('en') });
    expect(screen.getByText(/7,700/)).toBeTruthy();
    expect(screen.getByText(/\/ week/)).toBeTruthy();
    expect(screen.getByText(/Deposit/)).toBeTruthy();
  });
  it('derives the monthly price from the daily one (ar)', async () => {
    await render(<PriceTag prices={CARD.prices} period="month" />, { wrapper: wrap('ar') });
    expect(screen.getByText(/36,000/)).toBeTruthy();
  });
});

describe('Badges', () => {
  it('shows a fresh chip within 48 hours and nothing after 7 days', async () => {
    const { rerender } = await render(<FreshnessChip lastConfirmedAt="2026-09-20T08:00:00Z" />, { wrapper: wrap('en') });
    expect(screen.getByText(/Confirmed/)).toBeTruthy();
    await rerender(<FreshnessChip lastConfirmedAt="2026-09-01T08:00:00Z" />);
    expect(screen.queryByText(/Confirmed/)).toBeNull();
  });
  it('always pairs status with a text label', async () => {
    await render(<Badge kind="verified" />, { wrapper: wrap('ar') });
    expect(screen.getByText('موثّق')).toBeTruthy();
  });
});

describe('Fields', () => {
  it('normalises Arabic-Indic digits in the phone field', async () => {
    const onChangeText = jest.fn();
    await render(<PhoneField label="Mobile number" onChangeText={onChangeText} />, { wrapper: wrap('en') });
    await fireEvent.changeText(screen.getByLabelText('Mobile number'), '٠١٠١٢٣٤٥٦٧٨');
    expect(onChangeText).toHaveBeenCalledWith('01012345678');
  });
  it('completes the OTP once six digits arrive (SMS autofill or paste)', async () => {
    const onComplete = jest.fn();
    const onChange = jest.fn();
    await render(<OTPField label="Code" value="" onChange={onChange} onComplete={onComplete} />, { wrapper: wrap('en') });
    await fireEvent.changeText(screen.getByTestId('otp-input'), '12 34 56');
    expect(onChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});

describe('ListingCard', () => {
  it('renders the facts before contact and calls onContact per channel (ar)', async () => {
    const onContact = jest.fn();
    const onPress = jest.fn();
    await render(<ListingCard card={CARD} onPress={onPress} onContact={onContact} />, { wrapper: wrap('ar') });
    expect(screen.getByText(/تويوتا كورولا 2024/)).toBeTruthy();
    expect(screen.getByText(/مميّز/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'واتساب' }));
    expect(onContact).toHaveBeenCalledWith('whatsapp');
    await fireEvent.press(screen.getByRole('link', { name: 'تويوتا كورولا 2024' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('renders in dark mode (en) with the call action', async () => {
    const onContact = jest.fn();
    await render(<ListingCard card={CARD} onPress={() => undefined} onContact={onContact} />, { wrapper: wrap('en', 'dark') });
    await fireEvent.press(screen.getByRole('button', { name: 'Call' }));
    expect(onContact).toHaveBeenCalledWith('call');
  });
});

describe('Other components', () => {
  it('ChipGroup single mode toggles one value', async () => {
    const onChange = jest.fn();
    await render(<ChipGroup label="Period" single value={['day']} onChange={onChange} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />, { wrapper: wrap('en') });
    await fireEvent.press(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith(['week']);
  });
  it('RatingStars input selects a value', async () => {
    const onChange = jest.fn();
    await render(<RatingStars value={0} onChange={onChange} />, { wrapper: wrap('en') });
    await fireEvent.press(screen.getAllByRole('radio')[3]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });
  it('RequirementList, ContactBar and EmptyState render their copy', async () => {
    const onContact = jest.fn();
    await render(
      <>
        <RequirementList deposit={0} minAge={21} requiredDocs={['passport']} kmLimitPerDay={null} airportPickup />
        <ContactBar prices={CARD.prices} onContact={onContact} />
        <EmptyState body="Try another area" />
      </>,
      { wrapper: wrap('en') },
    );
    expect(screen.getAllByText(/No deposit/).length).toBeGreaterThan(0);
    expect(screen.getByText('Try another area')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(onContact).toHaveBeenCalledWith('whatsapp');
  });
});
