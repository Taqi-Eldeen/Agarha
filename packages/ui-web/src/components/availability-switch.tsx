'use client';
import * as Switch from '@radix-ui/react-switch';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export interface AvailabilitySwitchProps {
  available: boolean;
  /** Persist the change. Throwing rolls the switch back. */
  onChange: (available: boolean) => Promise<void>;
  /** Called after a successful change so the app can show a Toast with an Undo action. */
  onChanged?: (available: boolean, undo: () => void) => void;
  label: string;
}

/** One-tap availability with optimistic update, rollback on failure and undo. */
export function AvailabilitySwitch({ available, onChange, onChanged, label }: AvailabilitySwitchProps) {
  const { t } = useUi();
  const [value, setValue] = useState(available);
  const [busy, setBusy] = useState(false);
  const apply = async (next: boolean, notify: boolean) => {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      await onChange(next);
      if (notify) onChanged?.(next, () => void apply(prev, false));
    } catch {
      setValue(prev);
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3">
      <Switch.Root
        checked={value}
        disabled={busy}
        onCheckedChange={(v) => void apply(v, true)}
        aria-label={label}
        className={cn('relative h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-fast', value ? 'bg-available' : 'bg-border')}
      >
        <Switch.Thumb className="block size-7 rounded-full bg-white shadow-1 transition-transform duration-fast data-[state=checked]:translate-x-6 rtl:data-[state=checked]:-translate-x-6" />
      </Switch.Root>
      <span className={cn('text-caption font-medium', value ? 'text-available' : 'text-fg-secondary')}>{value ? t.available : t.unavailable}</span>
    </label>
  );
}
