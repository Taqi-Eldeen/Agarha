# Legal and compliance checklist (Egypt)

Not legal advice: this is the list to take to an Egyptian lawyer before launch. ✅ = handled in the
product; ☐ = needs counsel or a business action.

## Company and brand

- ☐ Incorporate (LLC or a one-person company) and obtain a commercial registration and tax card.
- ☐ VAT registration (mandatory above EGP 500k annual turnover); decide whether to register voluntarily
  from day one because dealer plans are VAT-inclusive (ADR-0016).
- ☐ Egyptian Tax Authority e-invoicing / e-receipt onboarding for B2B invoices to dealers.
- ☐ Trademark search and filing: "أجّرها", "Agarha", "Ajarha", classes 35, 39, 42 (ITDA; consider WIPO).
- ☐ Register the `.eg` domains through an accredited registrar (needs the CR).

## Personal Data Protection Law (Law 151/2020) and executive regulations

- ✅ Data map of every personal-data field, purpose, lawful basis and retention (`docs/data-map.md`).
- ✅ Data minimisation: customers give a phone number only; national IDs are never collected from
  customers; dealer documents are private, encrypted at rest, shown to admins via 5-minute links and audited.
- ✅ Data-subject rights: export and delete account in-app and on the web (`PrivacyContributor` per module).
- ✅ Retention schedule enforced by a daily job (ADR-0020).
- ✅ Consent for marketing messages is separate and off by default; transactional messages only otherwise.
- ✅ EXIF/GPS stripped from uploaded photos.
- ✅ Security measures: TLS everywhere, encryption at rest (RDS/KMS, R2), RLS, audit log, MFA for admins
  and dealers.
- ☐ Licence or permit from the Personal Data Protection Center (PDPC) as a controller/processor, once
  the executive regulations' licensing procedures apply to us.
- ☐ **Cross-border transfer**: hosting outside Egypt (ADR-0010) needs PDPC authorisation or an
  applicable exemption. Decide the region with counsel.
- ☐ Appoint a Data Protection Officer (required for controllers above the thresholds in the regulations).
- ☐ Breach notification procedure (72 hours to the PDPC) — technical side in `docs/runbooks/incident.md`.
- ☐ Processor agreements (DPAs) with Twilio, Vonage, Meta (WhatsApp), Resend, Expo, PostHog, Sentry,
  Cloudflare, AWS, Paymob, the maps provider.

## Consumer protection (Law 181/2018) and e-commerce

- ✅ Prices shown VAT-inclusive in EGP; "indicative, confirm with the office" wording.
- ✅ Clear identification of the dealer (verified business name, CR checked) on every listing.
- ☐ Terms of use, privacy policy and dealer terms reviewed by counsel (drafts in
  `packages/i18n` → `web.legal`; pages at `/legal/*`).
- ☐ Confirm Agarha is an intermediary (not the rental provider) under consumer-protection rules, and
  that the liability limitation in the terms is enforceable.

## Messaging and telecom

- ☐ SMS sender ID "Agarha" registration with Egyptian carriers (via Twilio/Vonage).
- ☐ WhatsApp Business: Meta business verification and template approval (OTP, lead alert, nudge).
- ✅ Opt-out on every marketing message; OTP messages carry no marketing.

## Payments (dealers only)

- ☐ Paymob merchant agreement; Central Bank rules apply to Paymob, not to us, as long as we use hosted
  checkout (no card data on our servers — ADR-0016).
- ☐ Refund and cancellation policy for dealer subscriptions.

## App stores

- ✅ Account deletion inside the app (App Store 5.1.1(v), Google Play policy).
- ✅ Sign in with Apple offered next to Google on iOS (4.8).
- ✅ iOS privacy manifest and Play data-safety answers drafted (`apps/mobile/store/listing.md`).
- ☐ App Review demo account and test phone number that bypasses OTP safely (open question).

## Accessibility

- ✅ WCAG 2.2 AA targets, automated axe checks in E2E, RTL and both themes.
