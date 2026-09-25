# ADR-0017: CSP allows inline scripts and styles at v1

- Status: Proposed · Date: 2026-09

## Context

Next.js App Router injects inline bootstrap scripts. A nonce-based CSP forces every page to render
dynamically (no static or ISR pages), which hurts TTFB and cost on the SEO landing pages.

## Decision

`script-src 'self' 'unsafe-inline'` plus the Turnstile, PostHog and Sentry origins; every other
directive is strict (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`,
`base-uri 'self'`, `form-action 'self'`). XSS is mitigated by React escaping, no
`dangerouslySetInnerHTML` except escaped JSON-LD, and input validation.

## Consequences

- Revisit when Next.js supports hashes for static pages, or move dealer and admin pages (already
  dynamic) to nonces first.
