import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CARD } from '../test/render';
import { AvailabilitySwitch } from './availability-switch';
import { Badge, FreshnessChip } from './badge';
import { Button, IconButton } from './button';
import { ChipGroup, FilterChip } from './chips';
import { ContactBar } from './contact-bar';
import { DataTable, StatTile } from './data';
import { DealerCard } from './dealer-card';
import { Drawer } from './drawer';
import { EmptyState, ErrorState, InlineAlert, useToast } from './feedback';
import { OTPField, PhoneField, TextField } from './fields';
import { Gallery } from './gallery';
import { ListingCard, ListingCardSkeleton } from './listing-card';
import { PhotoUploader, type UploadItem } from './photo-uploader';
import { PriceTag } from './price-tag';
import { RatingStars, ReviewItem } from './rating';
import { RequirementList } from './requirement-list';
import { Combobox, Select } from './select';
import { Wizard } from './stepper';
import { WhatsAppIcon } from './whatsapp-icon';

const meta: Meta = { title: 'Design system' };
export default meta;
type S = StoryObj;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const img = (hex: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="${hex}"/></svg>`)}`;
const card = { ...CARD, photo: { url320: img('#8d99ae'), url640: img('#8d99ae'), blurhash: null } };

export const Buttons: S = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="whatsapp" icon={<WhatsAppIcon />}>
        WhatsApp
      </Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
      <IconButton label="Share" icon={<span aria-hidden>↗</span>} variant="secondary" />
    </div>
  ),
};

export const Fields: S = {
  render: function Render() {
    const [otp, setOtp] = useState('12');
    const [v, setV] = useState<string | undefined>();
    const [m, setM] = useState<string | undefined>();
    return (
      <div className="flex max-w-md flex-col gap-4">
        <TextField label="Business name" hint="As on the commercial registration" />
        <TextField label="Tax card" error="Enter the 9-digit tax card number" />
        <PhoneField label="Mobile number" placeholder="010 1234 5678" />
        <OTPField label="Verification code" value={otp} onChange={setOtp} />
        <Select
          label="Transmission"
          value={v}
          onValueChange={setV}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'manual', label: 'Manual' },
          ]}
        />
        <Combobox
          label="Car model"
          value={m}
          onValueChange={setM}
          options={[
            { value: 'c', label: 'Toyota Corolla', hint: 'تويوتا كورولا' },
            { value: 'e', label: 'Hyundai Elantra', hint: 'هيونداي إلنترا' },
          ]}
        />
      </div>
    );
  },
};

export const ChipsAndBadges: S = {
  render: function Render() {
    const [v, setV] = useState<string[]>(['suv']);
    return (
      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Type"
          options={[
            { value: 'sedan', label: 'Sedan' },
            { value: 'suv', label: 'SUV' },
            { value: 'van', label: 'Van' },
          ]}
          value={v}
          onChange={setV}
        />
        <div className="flex gap-2">
          <FilterChip label="Automatic" onRemove={() => undefined} />
          <FilterChip label="≤ 1,500 EGP" onRemove={() => undefined} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge kind="verified" />
          <Badge kind="featured" />
          <Badge kind="fresh" />
          <Badge kind="stale" />
          <Badge kind="driver" />
          <FreshnessChip lastConfirmedAt={hoursAgo(3)} />
          <FreshnessChip lastConfirmedAt={hoursAgo(80)} />
        </div>
      </div>
    );
  },
};

export const Prices: S = {
  render: () => (
    <div className="flex gap-6">
      <PriceTag prices={CARD.prices} period="day" showDeposit />
      <PriceTag prices={CARD.prices} period="week" />
      <PriceTag prices={CARD.prices} period="month" size="lg" />
    </div>
  ),
};

export const ListingCards: S = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <ListingCard card={card} href="#" onContact={() => undefined} />
      <ListingCard
        card={{
          ...card,
          featured: false,
          driverOption: 'driver',
          lastConfirmedAt: hoursAgo(90),
          available: false,
        }}
        href="#"
        onContact={() => undefined}
        period="week"
      />
      <ListingCard card={card} href="#" variant="map-mini" />
      <ListingCardSkeleton />
    </div>
  ),
};

export const DealerAndRequirements: S = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <DealerCard
        name="Nile Rentals"
        href="#"
        verified
        area="Nasr City"
        reviews={{ count: 23, average: 4.6 }}
        responseRate={0.92}
        responseRateLabel="Replies to 92% of enquiries"
        memberSinceLabel="On Agarha since 2026"
      />
      <RequirementList
        deposit={5000}
        minAge={23}
        requiredDocs={['national_id', 'egyptian_driving_licence']}
        kmLimitPerDay={200}
        airportPickup
      />
    </div>
  ),
};

export const GalleryAndContact: S = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Gallery
        alt="Toyota Corolla 2024"
        photos={[
          { id: '1', src: img('#8d99ae') },
          { id: '2', src: img('#1d3557') },
        ]}
      />
      <ContactBar
        prices={CARD.prices}
        onContact={() => undefined}
        notice="Never pay a deposit before seeing the car."
      />
    </div>
  ),
};

export const DealerTools: S = {
  render: function Render() {
    const toast = useToast();
    const [items, setItems] = useState<UploadItem[]>([
      { id: 'a', previewUrl: img('#8d99ae'), status: 'ready' },
      { id: 'b', previewUrl: img('#1d3557'), status: 'uploading', progress: 0.45 },
      { id: 'c', previewUrl: img('#c1121f'), status: 'failed' },
    ]);
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <AvailabilitySwitch
          available
          label="Toyota Corolla 2024"
          onChange={async () => undefined}
          onChanged={(v, undo) =>
            toast({
              tone: 'success',
              text: v ? 'Available' : 'Not available',
              action: { label: 'Undo', onClick: undo },
            })
          }
        />
        <Wizard
          steps={['Car', 'Prices', 'Photos']}
          current={2}
          onNext={() => undefined}
          onBack={() => undefined}
        >
          <PhotoUploader
            items={items}
            onAdd={() => undefined}
            onRemove={(id) => setItems((x) => x.filter((i) => i.id !== id))}
            onRetry={() => undefined}
            onReorder={(ids) => setItems((x) => ids.map((id) => x.find((i) => i.id === id)!))}
          />
        </Wizard>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Views" value="1,204" trend="up" />
          <StatTile label="Contacts" value="86" />
          <StatTile label="Freshness" value="92%" hint="Confirmed this week" />
        </div>
        <DataTable
          caption="Cars"
          rows={[
            { id: '1', car: 'Corolla 2024', views: 320 },
            { id: '2', car: 'Elantra 2023', views: 190 },
          ]}
          rowKey={(r) => r.id}
          columns={[
            { key: 'car', header: 'Car', cell: (r) => r.car },
            {
              key: 'views',
              header: 'Views',
              cell: (r) => r.views,
              sortValue: (r) => r.views,
              numeric: true,
            },
          ]}
        />
      </div>
    );
  },
};

export const States: S = {
  render: () => (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="warning" title="Never pay a deposit before seeing the car">
        Agarha is not a party to any rental.
      </InlineAlert>
      <InlineAlert tone="success">Saved</InlineAlert>
      <EmptyState
        body="No cars match these filters. Remove a filter or widen the price range."
        action={<Button variant="secondary">Clear filters</Button>}
      />
      <ErrorState body="We could not load results." onRetry={() => undefined} requestId="7f3c…" />
      <div className="flex items-center gap-4">
        <RatingStars value={4} />
        <RatingStars value={3} onChange={() => undefined} />
      </div>
      <ReviewItem
        rating={5}
        body="The car was exactly as listed."
        date={hoursAgo(50)}
        reply="Thank you!"
      />
    </div>
  ),
};

export const DrawerSheet: S = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Filters</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Filters"
          footer={<Button block>Show 24 cars</Button>}
        >
          <ChipGroup
            label="Type"
            options={[{ value: 'suv', label: 'SUV' }]}
            value={[]}
            onChange={() => undefined}
          />
        </Drawer>
      </>
    );
  },
};
