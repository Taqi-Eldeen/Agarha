// Postgres enums, generated from the shared arrays in @agarha/schemas so client and DB never drift.
import {
  CAR_BODY_TYPES,
  DEALER_STATUSES,
  DELIVERY_OPTIONS,
  DRIVER_OPTIONS,
  FUELS,
  LEAD_CHANNELS,
  LEAD_OUTCOMES,
  LISTING_STATUSES,
  LOCALES,
  MEDIA_STATUSES,
  OTP_CHANNELS,
  OTP_PURPOSES,
  REPORT_REASONS,
  REPORT_STATUSES,
  REQUIRED_DOCS,
  REVIEW_STATUSES,
  ROLES,
  SUBSCRIPTION_STATUSES,
  TRANSMISSIONS,
  VERIFICATION_DOC_STATUSES,
  VERIFICATION_DOC_TYPES,
} from '@agarha/schemas';
import { pgEnum } from 'drizzle-orm/pg-core';

export const localeEnum = pgEnum('locale', LOCALES);
export const roleEnum = pgEnum('role', ROLES);
export const listingStatusEnum = pgEnum('listing_status', LISTING_STATUSES);
export const driverOptionEnum = pgEnum('driver_option', DRIVER_OPTIONS);
export const transmissionEnum = pgEnum('transmission', TRANSMISSIONS);
export const fuelEnum = pgEnum('fuel', FUELS);
export const requiredDocEnum = pgEnum('required_doc', REQUIRED_DOCS);
export const deliveryOptionEnum = pgEnum('delivery_option', DELIVERY_OPTIONS);
export const carBodyTypeEnum = pgEnum('car_body_type', CAR_BODY_TYPES);
export const leadChannelEnum = pgEnum('lead_channel', LEAD_CHANNELS);
export const leadOutcomeEnum = pgEnum('lead_outcome', LEAD_OUTCOMES);
export const otpChannelEnum = pgEnum('otp_channel', OTP_CHANNELS);
export const otpPurposeEnum = pgEnum('otp_purpose', OTP_PURPOSES);
export const dealerStatusEnum = pgEnum('dealer_status', DEALER_STATUSES);
export const verificationDocTypeEnum = pgEnum('verification_doc_type', VERIFICATION_DOC_TYPES);
export const verificationDocStatusEnum = pgEnum('verification_doc_status', VERIFICATION_DOC_STATUSES);
export const reportReasonEnum = pgEnum('report_reason', REPORT_REASONS);
export const reportStatusEnum = pgEnum('report_status', REPORT_STATUSES);
export const reviewStatusEnum = pgEnum('review_status', REVIEW_STATUSES);
export const mediaStatusEnum = pgEnum('media_status', MEDIA_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const userStatusEnum = pgEnum('user_status', ['active', 'blocked', 'deleted']);
export const dealerMemberRoleEnum = pgEnum('dealer_member_role', ['dealer_owner', 'dealer_staff']);
export const deliveryStatusEnum = pgEnum('delivery_status', ['queued', 'sent', 'delivered', 'failed']);
export const notificationChannelEnum = pgEnum('notification_channel', ['sms', 'whatsapp', 'push', 'email']);
export const sessionScopeEnum = pgEnum('session_scope', ['customer', 'dealer', 'admin']);
export const socialProviderEnum = pgEnum('social_provider', ['google', 'apple', 'google_workspace']);
export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'open', 'paid', 'void', 'failed']);
export const availabilityRequestStatusEnum = pgEnum('availability_request_status', ['sent', 'available', 'unavailable', 'expired']);
export const importStatusEnum = pgEnum('import_status', ['validating', 'ready', 'applied', 'failed']);
