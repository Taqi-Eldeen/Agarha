import { toWesternDigits } from '@agarha/schemas/phone';
import { forwardRef, useRef, type ReactNode } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

interface FieldShellProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  children: ReactNode;
}

/** Label above, hint or plain-language error below (icon + text, never colour alone). */
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const { t } = useUi();
  return (
    <View className="gap-1">
      <Text weight="medium">
        {label}
        {optional ? <Text variant="caption" tone="secondary">{`  ${t.optional}`}</Text> : null}
      </Text>
      {children}
      {hint && !error ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text
          variant="caption"
          tone="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {`⚠ ${error}`}
        </Text>
      ) : null}
    </View>
  );
}

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
}

const inputClass = 'h-12 w-full rounded-md border bg-card px-3 text-body text-fg';

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, optional, className, ...props },
  ref,
) {
  const { colors, font, dir } = useUi();
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textSecondary}
        className={cn(inputClass, font(), error ? 'border-danger' : 'border-border', className)}
        style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
        {...props}
      />
    </FieldShell>
  );
});

/** Egyptian mobile: accepts 01X…, +20…, 0020…, Arabic-Indic digits; always LTR. */
export const PhoneField = forwardRef<TextInput, TextFieldProps>(function PhoneField(
  { label, hint, error, onChangeText, ...props },
  ref,
) {
  const { t, colors, font } = useUi();
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <View className="flex-row items-stretch gap-2" style={{ direction: 'ltr' }}>
        <View className="justify-center rounded-md border border-border bg-page px-3">
          <Text variant="caption" tone="secondary">
            {t.phonePrefix}
          </Text>
        </View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholderTextColor={colors.textSecondary}
          className={cn(inputClass, 'flex-1', font(), error ? 'border-danger' : 'border-border')}
          // Phone numbers are always LTR, whatever the UI direction.
          // eslint-disable-next-line agarha/no-physical-direction
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
          onChangeText={(v) => onChangeText?.(toWesternDigits(v))}
          {...props}
        />
      </View>
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

/**
 * One hidden input drives six boxes: SMS autofill (iOS oneTimeCode / Android sms-otp) and paste land
 * in one place. Always LTR.
 */
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
  const input = useRef<TextInput>(null);
  return (
    <View className="gap-2">
      <Text weight="medium">{label}</Text>
      <Pressable
        accessibilityRole="none"
        onPress={() => input.current?.focus()}
        className="flex-row gap-2"
        style={{ direction: 'ltr' }}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            accessibilityLabel={f('otpDigit', { index: i + 1 })}
            className={cn(
              'h-14 w-12 items-center justify-center rounded-md border bg-card',
              error ? 'border-danger' : i === value.length ? 'border-brand' : 'border-border',
            )}
          >
            <Text variant="h2">{value[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        testID="otp-input"
        accessibilityLabel={label}
        value={value}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        caretHidden
        className="absolute h-px w-px opacity-0"
        onChangeText={(next) => {
          const clean = toWesternDigits(next).replace(/\D/g, '').slice(0, length);
          onChange(clean);
          if (clean.length === length) onComplete?.(clean);
        }}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
