import type { ListingCard as Card } from '@agarha/schemas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AvailabilitySwitch, Badge, Button, ChipGroup, clusterPins, Combobox, ContactBar, EmptyState, FreshnessChip, hexToChannels, ListingCard, OTPField, PhoneField, PriceTag, RatingStars, RequirementList, Select, themeVars, UiProvider, zoomOf } from '../index';

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

describe('Map clustering', () => {
  const region = { latitude: 30.05, longitude: 31.24, latitudeDelta: 0.4, longitudeDelta: 0.4 };
  const pin = (id: string, lat: number, lng: number) => ({ id, lat, lng, price: 1000, featured: false });
  it('groups nearby pins into a cluster that zooms in when expanded', () => {
    const items = clusterPins([pin('a', 30.05, 31.24), pin('b', 30.0501, 31.2401), pin('c', 30.0502, 31.2402), pin('far', 30.2, 31.05)], region);
    const cluster = items.find((i) => i.kind === 'cluster');
    expect(cluster && cluster.kind === 'cluster' ? cluster.count : 0).toBe(3);
    expect(cluster && cluster.kind === 'cluster' ? cluster.zoomTo.longitudeDelta : 1).toBeLessThan(region.longitudeDelta);
    expect(items.filter((i) => i.kind === 'pin').map((i) => i.id)).toEqual(['far']);
  });
  it('shows single pins when zoomed in far enough', () => {
    const items = clusterPins([pin('a', 30.05, 31.24), pin('b', 30.06, 31.25)], { ...region, latitudeDelta: 0.005, longitudeDelta: 0.005 });
    expect(items.every((i) => i.kind === 'pin')).toBe(true);
  });
  it('derives zoom from the longitude span', () => {
    expect(zoomOf({ ...region, longitudeDelta: 360 })).toBe(0);
    expect(zoomOf({ ...region, longitudeDelta: 0.35 })).toBe(10);
  });
});

describe('Select, Combobox and AvailabilitySwitch', () => {
  const options = [{ value: 'cairo', label: 'القاهرة' }, { value: 'giza', label: 'الجيزة' }, { value: 'alex', label: 'الإسكندرية' }];
  it('Select opens a sheet and picks an option', async () => {
    const onValueChange = jest.fn();
    await render(<Select label="City" options={options} value="cairo" onValueChange={onValueChange} />, { wrapper: wrap('ar') });
    await fireEvent.press(screen.getByRole('combobox', { name: 'City' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'الجيزة' }));
    expect(onValueChange).toHaveBeenCalledWith('giza');
  });
  it('Combobox filters with Arabic normalization (ا/إ/أ are the same letter)', async () => {
    await render(<Combobox label="City" options={options} value={undefined} onValueChange={jest.fn()} />, { wrapper: wrap('ar') });
    await fireEvent.press(screen.getByRole('combobox', { name: 'City' }));
    await fireEvent.changeText(screen.getByLabelText('دوّر على موديل أو منطقة'), 'الاسكندريه');
    expect(screen.getByText('الإسكندرية')).toBeTruthy();
    expect(screen.queryByText('الجيزة')).toBeNull();
  });
  it('AvailabilitySwitch updates optimistically, offers undo and rolls back on failure', async () => {
    const onChange = jest.fn(async () => undefined);
    const onChanged = jest.fn();
    await render(<AvailabilitySwitch label="Toyota" available onChange={onChange} onChanged={onChanged} />, { wrapper: wrap('en') });
    await fireEvent(screen.getByLabelText('Toyota'), 'valueChange', false);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(onChanged).toHaveBeenCalledWith(false, expect.any(Function));
    expect(screen.getByText('Not available right now')).toBeTruthy();
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    await render(<AvailabilitySwitch label="Kia" available onChange={failing} />, { wrapper: wrap('en') });
    await fireEvent(screen.getByLabelText('Kia'), 'valueChange', false);
    expect(screen.getByText('Available')).toBeTruthy();
  });
});
