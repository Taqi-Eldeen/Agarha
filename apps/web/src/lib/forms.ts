'use client';
import { ApiRequestError } from '@agarha/api-client';
import { useTranslations } from 'next-intl';
import type { FieldErrors, FieldValues, Path, Resolver, UseFormReturn } from 'react-hook-form';

/** The subset of a Zod schema the resolver needs (keeps zod itself out of this module's types). */
interface SafeParser {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | {
        success: false;
        error: {
          issues: {
            path: PropertyKey[];
            message: string;
            code: string;
            minimum?: unknown;
            input?: unknown;
          }[];
        };
      };
}

/** Maps a Zod issue to an `errors.*` catalog key: a custom message code wins, else the issue kind. */
export function issueKey(
  i: { message: string; code: string; minimum?: unknown; input?: unknown },
  known: (k: string) => boolean,
): string {
  if (known(i.message)) return i.message;
  if (i.input === undefined || i.input === '' || (i.code === 'too_small' && Number(i.minimum) <= 1))
    return 'required';
  if (i.code === 'too_small') return 'too_short';
  if (i.code === 'too_big') return 'too_long';
  if (i.code === 'invalid_type') return 'invalid_number';
  if (i.code === 'invalid_format' || i.code === 'invalid_string') return 'invalid_format';
  return 'validation_failed';
}

/**
 * React Hook Form resolver backed by a shared @agarha/schemas Zod schema, so the form and the API
 * validate with the same rules. `toInput` turns form values (strings) into the schema's input.
 * Error messages are catalog keys; render them with useFieldError().
 */
export function schemaResolver<T extends FieldValues>(
  schema: SafeParser,
  toInput: (v: T) => unknown = (v) => v,
  known: (k: string) => boolean = () => false,
): Resolver<T> {
  return async (values) => {
    const r = schema.safeParse(toInput(values));
    if (r.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const i of r.error.issues) {
      const k = String(i.path[0] ?? 'root');
      errors[k] ??= { type: i.code, message: issueKey(i, known) };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

/** Translates field errors (catalog keys) for display under a field. */
export function useFieldError() {
  const te = useTranslations('errors');
  const known = (k: string) => te.has(k as never);
  const text = (message?: string) =>
    message ? (known(message) ? te(message as never) : te('validation_failed')) : undefined;
  return { text, known };
}

/** Puts the API's `details.fieldErrors` onto the form (server-side rules the client can't check). */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown,
): boolean {
  const fe =
    err instanceof ApiRequestError
      ? (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors
      : undefined;
  if (!fe) return false;
  for (const [k, v] of Object.entries(fe))
    form.setError(k as Path<T>, { type: 'server', message: v[0] ?? 'validation_failed' });
  return true;
}
