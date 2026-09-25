import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  /** Applied-filter chips show a remove button instead of toggling. */
  onRemove?: () => void;
  icon?: ReactNode;
}

export function FilterChip({ label, selected, onToggle, onRemove, icon }: FilterChipProps) {
  const { t, colors, scheme } = useUi();
  if (onRemove)
    return (
      <View className="h-10 flex-row items-center gap-1 rounded-full border border-brand bg-brand-subtle ps-3">
        {icon}
        <Text variant="caption">{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t.remove}: ${label}`} onPress={onRemove} hitSlop={4} className="size-10 items-center justify-center rounded-full">
          <X size={16} color={colors.textPrimary} strokeWidth={1.75} />
        </Pressable>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onToggle}
      className={cn('min-h-touch flex-row items-center gap-1 rounded-full border px-4', selected ? 'border-brand bg-brand' : 'border-border bg-card')}
    >
      {icon}
      <Text variant="caption" tone="inherit" style={{ color: selected ? (scheme === 'light' ? '#FFFFFF' : colors.surfacePage) : colors.textPrimary }}>
        {label}
      </Text>
    </Pressable>
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
    <View accessibilityRole={single ? 'radiogroup' : undefined} accessibilityLabel={label} className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return <FilterChip key={o.value} label={o.label} selected={on} onToggle={() => onChange(single ? (on ? [] : [o.value]) : on ? value.filter((v) => v !== o.value) : [...value, o.value])} />;
      })}
    </View>
  );
}
