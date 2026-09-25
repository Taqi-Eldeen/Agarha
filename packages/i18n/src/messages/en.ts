// English catalog. Must have exactly the same keys as ar.ts (enforced by the Messages type).
import type { Messages } from './ar.js';

export const en: Messages = {
  common: {
    appName: 'Agarha',
    tagline: 'Rent a car with the facts upfront',
    languageSwitch: 'العربية',
    forDealers: 'For dealers',
    signIn: 'Sign in',
    signOut: 'Sign out',
    retry: 'Try again',
    loading: 'Loading…',
    comingSoon: 'We are getting the first verified dealers ready. Check back soon.',
  },
  price: {
    perDay: '{price} / day',
    perWeek: '{price} / week',
    perMonth: '{price} / month',
    deposit: 'Deposit {amount}',
  },
  freshness: {
    fresh: 'Confirmed {ago}',
    aging: 'Confirmed {ago}',
    stale: 'Last confirmed {ago}',
  },
  safety: {
    neverPayDeposit: 'Never pay a deposit before seeing the car.',
    notAParty: 'Agarha is not a party to any rental agreement.',
  },
  auth: {
    phoneLabel: 'Mobile number',
    phoneHint: 'Egyptian mobile, for example 010 1234 5678',
    sendCode: 'Send code',
    codeLabel: 'Verification code',
    codeSentSms: 'We sent a 6-digit code by SMS to {phone}.',
    codeSentWhatsapp: 'We sent a 6-digit code on WhatsApp to {phone}.',
    verify: 'Verify',
    resendIn: 'Resend in {seconds}s',
    resend: 'Resend code',
    useWhatsapp: 'Send on WhatsApp instead',
  },
  otpMessage: {
    body: 'Your Agarha code is {code}. It expires in {minutes} minutes. Never share it with anyone.',
  },
  errors: {
    validation_failed: 'Please check the highlighted fields.',
    invalid_egypt_mobile: 'Enter an Egyptian mobile number, for example 010 1234 5678.',
    rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
    captcha_failed: 'We could not confirm you are human. Please try again.',
    otp_invalid: 'That code is not right. Check the message and try again.',
    otp_expired: 'That code has expired. Request a new one.',
    otp_too_many_attempts: 'Too many wrong codes. Request a new one.',
    otp_delivery_failed: 'We could not send the code. Try WhatsApp or try again shortly.',
    unauthorized: 'Please sign in to continue.',
    forbidden: 'You do not have access to this.',
    not_found: 'We could not find that.',
    internal_error: 'Something went wrong on our side. Please try again.',
  },
};
