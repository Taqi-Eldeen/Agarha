import { useContactDealer } from '@agarha/api-client';
import { useToast } from '@agarha/ui-native';
import { useState } from 'react';
import { Linking } from 'react-native';
import { useTranslations } from 'use-intl';
import { track } from './analytics';
import { useLocale } from './i18n';

/** Logs the lead (reference code) then opens WhatsApp or the dialer. No sign-up wall. */
export function useContact(listingId: string, source: string) {
  const { locale } = useLocale();
  const t = useTranslations('web.listing');
  const toast = useToast();
  const mutation = useContactDealer();
  const [busy, setBusy] = useState<'whatsapp' | 'call' | null>(null);
  const contact = async (channel: 'whatsapp' | 'call') => {
    track('contact_clicked', { channel, listing_id: listingId, source });
    setBusy(channel);
    try {
      const lead = await mutation.mutateAsync({ listingId, channel, locale });
      track('lead_created', { channel, listing_id: listingId, ref: lead.refCode });
      await Linking.openURL(lead.url);
    } catch {
      toast({ tone: 'danger', text: t('contactError') });
    } finally {
      setBusy(null);
    }
  };
  return { contact, busy };
}
