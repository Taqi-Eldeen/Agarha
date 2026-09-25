import { leadMessage, leadUrl } from './lead-link';

const base = { dealerWhatsapp: '+201012345678', dealerPhone: '+20223456789', carAr: 'تويوتا كورولا', carEn: 'Toyota Corolla', year: 2024, refCode: 'AG-7K2Q' };

describe('lead links', () => {
  it('builds the Arabic WhatsApp message from the brief', () => {
    expect(leadMessage({ ...base, channel: 'whatsapp', locale: 'ar' })).toBe('مرحباً، أستفسر عن تويوتا كورولا ٢٠٢٤ على أجّرها (Ref AG-7K2Q)');
  });
  it('builds a wa.me link without the plus sign and with the ref encoded', () => {
    const url = leadUrl({ ...base, channel: 'whatsapp', locale: 'en' });
    expect(url.startsWith('https://wa.me/201012345678?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1]!)).toContain('(Ref AG-7K2Q)');
  });
  it('uses tel: for calls', () => {
    expect(leadUrl({ ...base, channel: 'call', locale: 'ar' })).toBe('tel:+20223456789');
  });
});
