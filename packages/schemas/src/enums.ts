// Shared enums. The API database enums are generated from these arrays so they cannot drift.

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export const ROLES = [
  'customer',
  'dealer_owner',
  'dealer_staff',
  'moderator',
  'support',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

export const LISTING_STATUSES = ['draft', 'pending', 'live', 'paused', 'hidden', 'archived'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const DRIVER_OPTIONS = ['self', 'driver', 'both'] as const;
export type DriverOption = (typeof DRIVER_OPTIONS)[number];

export const TRANSMISSIONS = ['automatic', 'manual'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const FUELS = ['petrol', 'diesel', 'hybrid', 'electric', 'natural_gas'] as const;
export type Fuel = (typeof FUELS)[number];

export const REQUIRED_DOCS = [
  'national_id',
  'passport',
  'egyptian_driving_licence',
  'international_driving_permit',
  'foreign_driving_licence',
  'utility_bill',
  'employment_letter',
] as const;
export type RequiredDoc = (typeof REQUIRED_DOCS)[number];

export const DELIVERY_OPTIONS = ['branch_pickup', 'home_delivery', 'hotel_delivery'] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

export const CAR_BODY_TYPES = [
  'sedan',
  'hatchback',
  'suv',
  'crossover',
  'minivan',
  'van',
  'pickup',
  'coupe',
  'convertible',
  'luxury',
] as const;
export type CarBodyType = (typeof CAR_BODY_TYPES)[number];

export const LEAD_CHANNELS = ['whatsapp', 'call'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_OUTCOMES = ['unknown', 'from_agarha', 'rented', 'not_rented', 'no_reply'] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export const OTP_CHANNELS = ['sms', 'whatsapp'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export const OTP_PURPOSES = ['customer_sign_in', 'dealer_sign_in', 'dealer_sign_up'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const DEALER_STATUSES = ['onboarding', 'pending_review', 'verified', 'rejected', 'suspended'] as const;
export type DealerStatus = (typeof DEALER_STATUSES)[number];

export const VERIFICATION_DOC_TYPES = [
  'commercial_registration',
  'tax_card',
  'owner_national_id',
  'branch_lease',
  'other',
] as const;
export type VerificationDocType = (typeof VERIFICATION_DOC_TYPES)[number];

export const VERIFICATION_DOC_STATUSES = ['uploaded', 'approved', 'rejected'] as const;
export type VerificationDocStatus = (typeof VERIFICATION_DOC_STATUSES)[number];

export const REPORT_REASONS = [
  'scam_or_deposit_request',
  'car_not_available',
  'wrong_price',
  'wrong_photos',
  'rude_or_unsafe',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'published', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const MEDIA_STATUSES = ['pending_upload', 'processing', 'ready', 'rejected'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PRICE_PERIODS = ['day', 'week', 'month'] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];
