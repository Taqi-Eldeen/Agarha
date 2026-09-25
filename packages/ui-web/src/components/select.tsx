'use client';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { FieldShell } from './fields';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectProps {
  label: string;
  options: Option[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Native <select> styled with tokens: the platform picker on phones (best on low-end Android), full
 * keyboard and screen-reader support, and no popper JS on public pages (listing-page budget).
 */
export function Select({ label, options, value, onValueChange, placeholder, error, disabled }: SelectProps) {
  const id = useId();
  const { t } = useUi();
  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="relative">
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('h-12 w-full appearance-none rounded-md border border-border bg-card pe-10 ps-3 text-body disabled:opacity-50 aria-[invalid=true]:border-danger', value ? 'text-fg' : 'text-fg-secondary')}
        >
          {!value ? (
            <option value="" disabled>
              {placeholder ?? t.selectPlaceholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-fg">
              {o.hint ? `${o.label} (${o.hint})` : o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-fg-secondary" strokeWidth={1.75} />
      </div>
    </FieldShell>
  );
}

export { Combobox } from './combobox';
