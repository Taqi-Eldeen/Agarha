import { describe, expect, it } from 'vitest';
import { otpRequestSchema, otpVerifySchema } from './auth.js';
import { listingFactsSchema } from './listing.js';

const uuid = '0b6c7f6e-8f3a-4a57-9a2f-5d7c1c9f2b11';

describe('otp schemas', () => {
  it('applies defaults and normalises phone', () => {
    const r = otpRequestSchema.parse({ phone: '01012345678', turnstileToken: 't' });
    expect(r).toMatchObject({ phone: '+201012345678', channel: 'sms', locale: 'ar' });
  });
  it('requires a turnstile token', () => {
    expect(otpRequestSchema.safeParse({ phone: '01012345678' }).success).toBe(false);
  });
  it('requires a 6 digit code', () => {
    const base = { challengeId: uuid, phone: '01012345678' };
    expect(otpVerifySchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(otpVerifySchema.safeParse({ ...base, code: '123456' }).success).toBe(true);
  });
});

describe('listingFactsSchema', () => {
  const valid = {
    carModelId: uuid,
    branchId: uuid,
    year: 2024,
    color: 'white',
    transmission: 'automatic',
    fuel: 'petrol',
    seats: 5,
    driverOption: 'self',
    priceDayEgp: 1500,
    priceWeekEgp: 9000,
    depositEgp: 5000,
    minAge: 23,
    requiredDocs: ['national_id', 'egyptian_driving_licence'],
    kmLimitPerDay: 200,
  };
  it('accepts a complete listing', () => {
    expect(listingFactsSchema.parse(valid).airportPickup).toBe(false);
  });
  it('rejects a weekly price above 7x daily', () => {
    const r = listingFactsSchema.safeParse({ ...valid, priceWeekEgp: 20000 });
    expect(r.success).toBe(false);
  });
  it('requires at least one required document', () => {
    expect(listingFactsSchema.safeParse({ ...valid, requiredDocs: [] }).success).toBe(false);
  });
});
