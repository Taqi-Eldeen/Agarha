'use client';
import { useContactDealer } from '@agarha/api-client';
import type { ListingCard as Card } from '@agarha/schemas';
import { ContactBar, ListingCard, useToast, type Prices } from '@agarha/ui-web';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { track } from '@/lib/analytics';

/** Logs the lead (reference code) then opens WhatsApp / the dialer. No sign-up wall. */
export function useContact(listingId: string, source: string) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('web.listing');
  const toast = useToast();
  const mutation = useContactDealer();
  const [busy, setBusy] = useState<'whatsapp' | 'call' | null>(null);
  const contact = async (channel: 'whatsapp' | 'call') => {
    track('contact_clicked', { channel, listing_id: listingId, source });
    // Open a window synchronously so popup blockers allow it, then point it at wa.me once we have the link.
    const win = channel === 'whatsapp' ? window.open('', '_blank') : null;
    if (win) win.opener = null;
    setBusy(channel);
    try {
      const lead = await mutation.mutateAsync({ listingId, channel, locale });
      track('lead_created', { channel, listing_id: listingId, ref: lead.refCode });
      if (win) win.location.href = lead.url;
      else window.location.href = lead.url;
    } catch {
      win?.close();
      toast({ tone: 'danger', text: t('contactError') });
    } finally {
      setBusy(null);
    }
  };
  return { contact, busy };
}

export function ListingContactBar({ listingId, prices, notice }: { listingId: string; prices: Prices; notice: ReactNode }) {
  const { contact, busy } = useContact(listingId, 'listing_page');
  return <ContactBar prices={prices} onContact={contact} contacting={busy} notice={notice} />;
}

export function ContactableCard({ card, href, period, priority, favorite }: { card: Card; href: string; period?: 'day' | 'week' | 'month'; priority?: boolean; favorite?: ReactNode }) {
  const { contact, busy } = useContact(card.id, 'card');
  return <ListingCard card={card} href={href} period={period} onContact={contact} contacting={busy} priority={priority} favorite={favorite} linkAs={({ href: h, className, children }) => <a href={h} className={className}>{children}</a>} />;
}
