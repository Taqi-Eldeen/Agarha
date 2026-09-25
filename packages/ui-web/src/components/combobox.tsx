'use client';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { normalizeArabic } from '@agarha/schemas/arabic';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { FieldShell } from './fields';
import type { Option, SelectProps } from './select';

/** Searchable select (car model, area). Matching is Arabic-normalised so "اسكندرية" finds "الإسكندرية". */
export function Combobox({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  error,
  disabled,
}: SelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const n = normalizeArabic(q);
    return n
      ? options.filter((o) => normalizeArabic(`${o.label} ${o.hint ?? ''}`).includes(n))
      : options;
  }, [q, options]);
  const selected = options.find((o) => o.value === value);
  const choose = (o: Option) => {
    onValueChange(o.value);
    setOpen(false);
    setQ('');
  };
  return (
    <FieldShell id={id} label={label} error={error}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={!!error || undefined}
            className={cn(
              'flex h-12 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-body',
              !selected && 'text-fg-secondary',
            )}
          >
            <span className="truncate">
              {selected?.label ?? placeholder ?? t.selectPlaceholder}
            </span>
            <ChevronDown aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            className="z-sheet w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-card p-2 shadow-2"
          >
            <input
              autoFocus
              aria-label={label}
              aria-controls={listId}
              aria-activedescendant={
                filtered[active] ? `${listId}-${filtered[active].value}` : undefined
              }
              placeholder={t.searchPlaceholder}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, filtered.length - 1));
                if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
                if (e.key === 'Enter' && filtered[active]) {
                  e.preventDefault();
                  choose(filtered[active]);
                }
              }}
              className="mb-2 h-11 w-full rounded-md border border-border bg-page px-3"
            />
            <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-auto">
              {filtered.length === 0 ? (
                <li className="p-3 text-caption text-fg-secondary">{t.noResults}</li>
              ) : null}
              {filtered.map((o, i) => (
                <li
                  id={`${listId}-${o.value}`}
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex min-h-touch cursor-pointer flex-col justify-center rounded-sm px-3',
                    i === active && 'bg-brand-subtle',
                  )}
                >
                  <span>{o.label}</span>
                  {o.hint ? <span className="text-caption text-fg-secondary">{o.hint}</span> : null}
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldShell>
  );
}
