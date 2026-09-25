# ADR-0024: Deferred at v1 — passkeys, customer payments, in-app chat

- Status: Proposed · Date: 2026-09

## Decision

Not in v1:

- **Passkeys/WebAuthn**: phone OTP (customers) and TOTP (dealers, admins) cover v1; passkeys are the
  next step for dealers.
- **Customer payments and deposits**: customers contact dealers by call, WhatsApp or an availability
  request; Agarha is not the merchant of record for rentals (lower regulatory and chargeback risk).
- **In-app chat**: WhatsApp is where Egyptian dealers already work; availability requests cover the
  asynchronous case.
- **Native `<select>`** on web instead of a custom listbox for simple choices (better on mobile and
  for screen readers); a Radix Combobox is used where search is needed.
