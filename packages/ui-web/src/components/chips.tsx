'use client';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  /** Applied-filter chips show a remove button instead of toggling. */
  onRemove?: () => void;
  icon?: ReactNode;
}

export function FilterChip({ label, selected, onToggle, onRemove, icon }: FilterChipProps) {
  const { t } = useUi();
  if (onRemove)
    return (
      <span className="inline-flex h-10 items-center gap-1 rounded-full border border-brand bg-brand-subtle ps-3 text-caption text-fg">
        {icon}
        {label}
        <button type="button" onClick={onRemove} aria-label={`${t.remove}: ${label}`} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-brand/10">
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      </span>
    );
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onToggle}
      className={cn('inline-flex h-10 min-h-touch items-center gap-1 rounded-full border px-4 text-caption transition-colors duration-fast', selected ? 'border-brand bg-brand text-white dark:text-page' : 'border-border bg-card text-fg hover:bg-brand-subtle')}
    >
      {icon}
      {label}
    </button>
  );
}

export interface ChipGroupProps<V extends string> {
  label: string;
  options: { value: V; label: string }[];
  value: V[];
  onChange: (value: V[]) => void;
  /** single = radio-like (one or none). */
  single?: boolean;
}

export function ChipGroup<V extends string>({ label, options, value, onChange, single }: ChipGroupProps<V>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return <FilterChip key={o.value} label={o.label} selected={on} onToggle={() => onChange(single ? (on ? [] : [o.value]) : on ? value.filter((v) => v !== o.value) : [...value, o.value])} />;
      })}
    </div>
  );
}
