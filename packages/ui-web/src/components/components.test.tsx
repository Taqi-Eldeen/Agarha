import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, CARD, renderUi } from '../test/render';
import { AvailabilitySwitch } from './availability-switch';
import { Badge, FreshnessChip } from './badge';
import { Button, IconButton } from './button';
import { ChipGroup, FilterChip } from './chips';
import { ContactBar } from './contact-bar';
import { DataTable, StatTile } from './data';
import { EmptyState, ErrorState, InlineAlert } from './feedback';
import { OTPField, PhoneField, TextField } from './fields';
import { Gallery } from './gallery';
import { ListingCard, ListingCardSkeleton } from './listing-card';
import { PriceTag, priceFor } from './price-tag';
import { RatingStars, ReviewItem } from './rating';
import { RequirementList } from './requirement-list';
import { Wizard } from './stepper';

describe.each(['ar', 'en'] as const)('components in %s', (locale) => {
  it('ListingCard shows the full anatomy and passes axe', async () => {
    const onContact = vi.fn();
    const { container } = renderUi(<ListingCard card={CARD} href="/cars/x" onContact={onContact} />, locale);
    const name = locale === 'ar' ? 'تويوتا كورولا' : 'Toyota Corolla';
    expect(screen.getByRole('article', { name: `${name} 2024` })).toBeInTheDocument();
    expect(screen.getByText(locale === 'ar' ? 'مميّز' : 'Featured')).toBeInTheDocument();
    expect(container.textContent).toContain(locale === 'ar' ? '1,500 ج.م' : '1,500 EGP');
    expect(container.textContent).toContain(locale === 'ar' ? 'بطاقة رقم قومي' : 'National ID');
    expect(container.textContent).toMatch(locale === 'ar' ? /اتأكد/ : /Confirmed/);
    await userEvent.click(screen.getByRole('button', { name: locale === 'ar' ? 'واتساب' : 'WhatsApp' }));
    expect(onContact).toHaveBeenCalledWith('whatsapp');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('PriceTag derives week/month and shows the deposit separately', () => {
    expect(priceFor(CARD.prices, 'month')).toBe(45000);
    const { container } = renderUi(<PriceTag prices={CARD.prices} period="week" showDeposit />, locale);
    expect(container.textContent).toContain(locale === 'ar' ? '9,000 ج.م' : '9,000 EGP');
    expect(container.textContent).toContain(locale === 'ar' ? 'التأمين' : 'Deposit');
  });

  it('FreshnessChip: green < 48h, amber 2–7 days, hidden after', () => {
    const h = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
    const { rerender, container } = renderUi(<FreshnessChip lastConfirmedAt={h(5)} />, locale);
    expect(container.firstChild).toHaveClass('text-available');
    rerender(<FreshnessChip lastConfirmedAt={h(72)} />);
    expect(container.firstChild).toHaveClass('text-stale');
    rerender(<FreshnessChip lastConfirmedAt={h(24 * 8)} />);
    expect(container.firstChild).toBeNull();
  });

  it('fields: labels above inputs, errors announced, phone normalises Arabic digits', async () => {
    const onChange = vi.fn();
    const { container } = renderUi(
      <>
        <TextField label="Name" error="Required" />
        <PhoneField label="Mobile" onChange={(e) => onChange(e.target.value)} />
      </>,
      locale,
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '٠١٠١٢٣' } });
    expect(onChange).toHaveBeenCalledWith('010123');
    expect(screen.getByLabelText('Mobile')).toHaveAttribute('dir', 'ltr');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('OTPField accepts a pasted code and completes', () => {
    const done = vi.fn();
    function Harness() {
      const [v, setV] = useState('');
      return <OTPField label="Code" value={v} onChange={setV} onComplete={done} />;
    }
    renderUi(<Harness />, locale);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    fireEvent.change(inputs[0]!, { target: { value: '123456' } });
    expect(done).toHaveBeenCalledWith('123456');
  });

  it('AvailabilitySwitch updates optimistically and rolls back on failure', async () => {
    const onChange = vi.fn().mockRejectedValueOnce(new Error('offline'));
    renderUi(<AvailabilitySwitch available label="Corolla" onChange={onChange} />, locale);
    const sw = screen.getByRole('switch', { name: 'Corolla' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('AvailabilitySwitch offers undo after a successful change', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    let undo: (() => void) | undefined;
    renderUi(<AvailabilitySwitch available label="Corolla" onChange={onChange} onChanged={(_v, u) => (undo = u)} />, locale);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(undo).toBeDefined());
    undo!();
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true));
  });

  it('chips toggle and removable chips have labelled remove buttons', async () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    renderUi(
      <>
        <ChipGroup label="Type" options={[{ value: 'suv', label: 'SUV' }, { value: 'sedan', label: 'Sedan' }]} value={['suv']} onChange={onChange} />
        <FilterChip label="Automatic" onRemove={onRemove} />
      </>,
      locale,
    );
    expect(screen.getByRole('button', { name: 'SUV' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Sedan' }));
    expect(onChange).toHaveBeenCalledWith(['suv', 'sedan']);
    await userEvent.click(screen.getByRole('button', { name: new RegExp('Automatic') }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('buttons: loading state is announced; icon buttons need a label', () => {
    renderUi(
      <>
        <Button loading>Save</Button>
        <IconButton label="Share" icon={<span>↗</span>} />
      </>,
      locale,
    );
    expect(screen.getByRole('button', { name: /Save/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('Gallery is manual and keyboard-navigable (arrow keys follow reading direction)', () => {
    renderUi(<Gallery alt="Corolla" photos={[{ id: 'a', src: '/a' }, { id: 'b', src: '/b' }, { id: 'c', src: '/c' }]} />, locale);
    const region = screen.getByRole('region', { name: 'Corolla' });
    fireEvent.keyDown(region, { key: locale === 'ar' ? 'ArrowLeft' : 'ArrowRight' });
    expect(region).toHaveTextContent('2 / 3');
  });

  it('ContactBar always shows WhatsApp and Call plus the deposit notice', () => {
    const { container } = renderUi(<ContactBar prices={CARD.prices} onContact={() => undefined} notice="Never pay a deposit before seeing the car." />, locale);
    expect(screen.getAllByRole('button', { name: locale === 'ar' ? 'واتساب' : 'WhatsApp' }).length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Never pay a deposit');
  });

  it('feedback + data components render accessibly', async () => {
    const { container } = renderUi(
      <main>
        <InlineAlert tone="warning" title="Heads up">
          Body
        </InlineAlert>
        <EmptyState body="No cars match. Try removing a filter." action={<Button>Clear filters</Button>} />
        <ErrorState body="Could not load." onRetry={() => undefined} requestId="abc" />
        <StatTile label="Views" value="1,204" trend="up" />
        <DataTable caption="Cars" rows={[{ id: '1', n: 'Corolla', v: 3 }, { id: '2', n: 'Elantra', v: 9 }]} rowKey={(r) => r.id} columns={[{ key: 'n', header: 'Car', cell: (r) => r.n }, { key: 'v', header: 'Views', cell: (r) => r.v, sortValue: (r) => r.v, numeric: true }]} />
        <RatingStars value={4} />
        <ReviewItem rating={5} body="Great" date={new Date().toISOString()} reply="Thanks" />
        <RequirementList deposit={0} minAge={25} requiredDocs={['passport']} kmLimitPerDay={null} airportPickup />
        <Badge kind="verified" />
        <ListingCardSkeleton />
      </main>,
      locale,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('Wizard shows progress and navigates', async () => {
    const onNext = vi.fn();
    renderUi(
      <Wizard steps={['Car', 'Prices', 'Photos']} current={1} onNext={onNext} onBack={() => undefined}>
        <p>body</p>
      </Wizard>,
      locale,
    );
    expect(screen.getByRole('heading', { name: 'Prices' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: locale === 'ar' ? 'التالي' : 'Next' }));
    expect(onNext).toHaveBeenCalled();
  });
});
