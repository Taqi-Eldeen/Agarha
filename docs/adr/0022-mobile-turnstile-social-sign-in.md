# ADR-0022: Mobile bot protection and social sign-in

- Status: Accepted · Date: 2026-09

## Decision

- Turnstile has no native SDK, so the app renders the widget in an invisible WebView pointed at the
  web host; the token is sent with the OTP request exactly as on the web.
- Sign in with Apple is offered on iOS whenever Google sign-in is (App Store guideline 4.8).
- Social sign-in creates the account, but contacting a dealer or reviewing requires linking a verified
  phone number (OTP) — the phone is what dealers call back.
