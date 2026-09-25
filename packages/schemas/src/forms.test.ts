import { describe, expect, it } from 'vitest';
import { branchInputSchema, businessSchema, inviteSchema, profileSchema } from './dealer.js';
import { priceFor } from './price.js';
import { availabilityRequestInputSchema, reportInputSchema } from './requests.js';

const LISTING = '00000000-0000-4000-8000-000000000001';

describe('priceFor', () => {
  const p = { day: 1000, week: 6000, month: null, deposit: 5000 };
  it('uses explicit period prices, else derives from the daily price', () => {
    expect(priceFor(p, 'day')).toBe(1000);
    expect(priceFor(p, 'week')).toBe(6000);
    expect(priceFor(p, 'month')).toBe(30000);
    expect(priceFor({ ...p, week: null }, 'week')).toBe(7000);
  });
});

describe('dealer business schema', () => {
  const ok = {
    legalName: 'Nile Rentals LLC',
    displayNameAr: 'نايل',
    displayNameEn: 'Nile',
    commercialRegistrationNo: '123456',
    taxCardNo: '111-222-333',
    phone: '0223456789',
    whatsapp: '01012345678',
  };
  it('normalises phones to E.164 and accepts CR/tax formats', () => {
    const r = businessSchema.parse(ok);
    expect(r.whatsapp).toBe('+201012345678');
    expect(r.phone).toBe('+20223456789');
  });
  it('rejects bad CR and tax numbers with catalog codes', () => {
    const r = businessSchema.safeParse({ ...ok, commercialRegistrationNo: '#', taxCardNo: '12' });
    expect(r.success).toBe(false);
    const codes = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(codes).toEqual(expect.arrayContaining(['invalid_cr', 'invalid_tax_card']));
  });
  it('profile edits never touch legal identity fields', () => {
    expect(Object.keys(profileSchema.shape)).not.toEqual(expect.arrayContaining(['legalName']));
    expect(profileSchema.parse({ displayNameEn: 'New name' })).toEqual({
      displayNameEn: 'New name',
    });
  });
});

describe('branch and invite schemas', () => {
  it('needs lat and lng together', () => {
    const base = { areaId: LISTING, nameAr: 'الفرع', nameEn: 'Main' };
    expect(branchInputSchema.safeParse(base).success).toBe(true);
    expect(branchInputSchema.safeParse({ ...base, lat: 30.05 }).success).toBe(false);
    expect(branchInputSchema.safeParse({ ...base, lat: 30.05, lng: 31.2 }).success).toBe(true);
  });
  it('invites staff by Egyptian mobile, defaulting to the staff role', () => {
    expect(inviteSchema.parse({ phone: '٠١٠١٢٣٤٥٦٧٨' })).toEqual({
      phone: '+201012345678',
      role: 'dealer_staff',
    });
    expect(inviteSchema.safeParse({ phone: '0223456789' }).success).toBe(false);
  });
});

describe('customer request schemas', () => {
  it('reports need a known reason and short details', () => {
    expect(
      reportInputSchema.safeParse({ listingId: LISTING, reason: 'scam_or_deposit_request' })
        .success,
    ).toBe(true);
    expect(reportInputSchema.safeParse({ listingId: LISTING, reason: 'spam' }).success).toBe(false);
    expect(
      reportInputSchema.safeParse({
        listingId: LISTING,
        reason: 'other',
        details: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });
  it('availability requests need ISO dates in order', () => {
    const r = { listingId: LISTING, startDate: '2026-10-01', endDate: '2026-10-05' };
    expect(availabilityRequestInputSchema.parse(r)).toMatchObject({ locale: 'ar' });
    const backwards = availabilityRequestInputSchema.safeParse({ ...r, endDate: '2026-09-30' });
    expect(backwards.success ? null : backwards.error.issues[0]?.message).toBe('end_before_start');
    expect(
      availabilityRequestInputSchema.safeParse({ ...r, startDate: '01/10/2026' }).success,
    ).toBe(false);
  });
});
