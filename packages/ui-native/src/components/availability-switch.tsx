import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export interface AvailabilitySwitchProps {
  available: boolean;
  /** Persist the change. Throwing rolls the switch back. */
  onChange: (available: boolean) => Promise<void>;
  /** Called after a successful change so the app can show a Toast with an Undo action. */
  onChanged?: (available: boolean, undo: () => void) => void;
  label: string;
}

/** One-tap availability with optimistic update, rollback on failure and undo. */
export function AvailabilitySwitch({
  available,
  onChange,
  onChanged,
  label,
}: AvailabilitySwitchProps) {
  const { t, colors } = useUi();
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
    <View className="min-h-touch flex-row items-center gap-3">
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={busy}
        onValueChange={(v) => void apply(v, true)}
        trackColor={{ true: colors.statusAvailable, false: colors.borderDefault }}
        thumbColor="#FFFFFF"
      />
      <Text
        variant="caption"
        weight="medium"
        style={{ color: value ? colors.statusAvailable : colors.textSecondary }}
      >
        {value ? t.available : t.unavailable}
      </Text>
    </View>
  );
}
