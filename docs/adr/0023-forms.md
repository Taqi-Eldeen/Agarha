# ADR-0023: Forms — React Hook Form + shared Zod schemas

- Status: Accepted · Date: 2026-09

## Decision

Each form's Zod schema lives in `packages/schemas` and is used twice: by React Hook Form on the client
(`apps/web/src/lib/forms.ts#schemaResolver`) and by the API's validation pipe. Validation messages are
issue codes (`invalid_cr`, `end_before_start`, …) translated in `packages/i18n`, so both languages
show the same rules. Server-side errors are mapped back onto fields (`applyServerErrors`).
