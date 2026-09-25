import { normalizeArabic } from '@agarha/schemas/arabic';
import { Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { FieldShell } from './fields';
import { BottomSheet } from './sheet';
import { Text } from './text';

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

function Picker({ searchable, label, options, value, onValueChange, placeholder, error, disabled }: SelectProps & { searchable: boolean }) {
  const { t, colors, font, dir } = useUi();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    if (!searchable || !q.trim()) return options;
    const needle = normalizeArabic(q.trim().toLowerCase());
    return options.filter((o) => normalizeArabic(o.label.toLowerCase()).includes(needle));
  }, [options, q, searchable]);
  return (
    <FieldShell label={label} error={error}>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder ?? t.selectPlaceholder }}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn('h-12 flex-row items-center justify-between rounded-md border bg-card px-3', error ? 'border-danger' : 'border-border', disabled && 'opacity-50')}
      >
        <Text tone={selected ? 'primary' : 'secondary'} numberOfLines={1}>
          {selected?.label ?? placeholder ?? t.selectPlaceholder}
        </Text>
        <ChevronDown size={20} color={colors.textSecondary} strokeWidth={1.75} />
      </Pressable>
      <BottomSheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }} title={label}>
        {searchable ? (
          <TextInput
            accessibilityLabel={t.searchPlaceholder}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={q}
            onChangeText={setQ}
            autoFocus
            className={cn('h-12 rounded-md border border-border bg-page px-3 text-body text-fg', font())}
            style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
          />
        ) : null}
        <View accessibilityRole="radiogroup">
          {shown.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: o.value === value }}
              onPress={() => {
                onValueChange(o.value);
                setOpen(false);
                setQ('');
              }}
              className="min-h-touch flex-row items-center justify-between border-b border-border py-2"
            >
              <View className="shrink">
                <Text>{o.label}</Text>
                {o.hint ? <Text variant="caption" tone="secondary">{o.hint}</Text> : null}
              </View>
              {o.value === value ? <Check size={20} color={colors.brandPrimary} strokeWidth={1.75} /> : null}
            </Pressable>
          ))}
          {!shown.length ? <Text tone="secondary">{t.noResults}</Text> : null}
        </View>
      </BottomSheet>
    </FieldShell>
  );
}

/** Pick one option from a bottom sheet. */
export function Select(props: SelectProps) {
  return <Picker {...props} searchable={false} />;
}

/** Select with type-to-filter (Arabic-normalized: alef forms, yaa/alef maqsura, taa marbuta). */
export function Combobox(props: SelectProps) {
  return <Picker {...props} searchable />;
}
