'use client';
import { AlertTriangle } from 'lucide-react';
import { toWesternDigits } from '@agarha/schemas/phone';
import { forwardRef, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  children: ReactNode;
}

/** Label above the field, hint and plain-language error below (WCAG: not colour alone — icon + text). */
export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  const { t } = useUi();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body font-medium text-fg">
        {label}
        {optional ? (
          <span className="ms-2 text-caption text-fg-secondary">{t.optional}</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-caption text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1 text-caption text-danger"
        >
          <AlertTriangle aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-md border border-border bg-card px-3 text-body text-fg placeholder:text-fg-secondary focus-visible:border-brand disabled:opacity-50 aria-[invalid=true]:border-danger';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, id, className, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} optional={optional}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(inputClass, className)}
        {...props}
      />
    </FieldShell>
  );
});

/** Egyptian mobile: accepts 01X…, +20…, 0020…, Arabic-Indic digits; always LTR. */
export const PhoneField = forwardRef<HTMLInputElement, TextFieldProps>(function PhoneField(
  { label, hint, error, id, onChange, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  const { t } = useUi();
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error}>
      <div className="flex items-stretch gap-2" dir="ltr">
        <span className="flex items-center rounded-md border border-border bg-page px-3 text-caption text-fg-secondary">
          {t.phonePrefix}
        </span>
        <input
          ref={ref}
          id={fid}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={cn(inputClass, 'ag-tabular')}
          onChange={(e) => {
            e.target.value = toWesternDigits(e.target.value);
            onChange?.(e);
          }}
          {...props}
        />
      </div>
    </FieldShell>
  );
});

export interface OTPFieldProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  label: string;
  error?: string | undefined;
  disabled?: boolean;
}

/** One input per digit, paste-friendly, autofills from SMS (autocomplete=one-time-code). Always LTR. */
export function OTPField({
  length = 6,
  value,
  onChange,
  onComplete,
  label,
  error,
  disabled,
}: OTPFieldProps) {
  const { f } = useUi();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const id = useId();
  const set = (next: string) => {
    const clean = toWesternDigits(next).replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1 text-body font-medium">{label}</legend>
      <div className="flex gap-2" dir="ltr">
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => void (refs.current[i] = el)}
            aria-label={f('otpDigit', { index: i + 1 })}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            disabled={disabled}
            value={value[i] ?? ''}
            aria-invalid={!!error || undefined}
            className="ag-tabular h-14 w-12 rounded-md border border-border bg-card text-center text-h2 aria-[invalid=true]:border-danger"
            onChange={(e) => {
              const typed = toWesternDigits(e.target.value).replace(/\D/g, '');
              if (typed.length > 1) set(typed);
              else set(value.slice(0, i) + typed + value.slice(i + 1));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
            }}
          />
        ))}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1 text-caption text-danger"
        >
          <AlertTriangle aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
