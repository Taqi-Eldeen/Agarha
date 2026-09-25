'use client';
import type { PricePeriod } from '@agarha/schemas';
import { Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUi } from '../lib/ui-context';
import { Button } from './button';
import { PriceTag, type Prices } from './price-tag';
import { WhatsAppIcon } from './whatsapp-icon';

export interface ContactBarProps {
  prices: Prices;
  period?: PricePeriod;
  onContact: (channel: 'whatsapp' | 'call') => void;
  contacting?: 'whatsapp' | 'call' | null;
  /** "Never pay a deposit before seeing the car" (risk #2). */
  notice: ReactNode;
}

/** Sticky bottom bar on phones, side card on desktop (≥ lg). WhatsApp and Call are always visible. */
export function ContactBar({
  prices,
  period = 'day',
  onContact,
  contacting,
  notice,
}: ContactBarProps) {
  const { t } = useUi();
  const buttons = (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Button
        variant="whatsapp"
        size="lg"
        icon={<WhatsAppIcon />}
        loading={contacting === 'whatsapp'}
        onClick={() => onContact('whatsapp')}
      >
        {t.whatsapp}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        icon={<Phone aria-hidden className="size-5" strokeWidth={1.75} />}
        loading={contacting === 'call'}
        onClick={() => onContact('call')}
      >
        {t.call}
      </Button>
    </div>
  );
  return (
    <>
      <aside className="sticky top-24 hidden flex-col gap-4 rounded-lg border border-border bg-card p-4 lg:flex">
        <PriceTag prices={prices} period={period} size="lg" showDeposit />
        {buttons}
        <div className="text-caption text-fg-secondary">{notice}</div>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-sticky flex flex-col gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <PriceTag prices={prices} period={period} showDeposit />
        </div>
        {buttons}
      </div>
    </>
  );
}
