import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Same variants as @agarha/ui-web buttonVariants. WhatsApp green is used only on the WhatsApp action.
const BOX: Record<ButtonVariant, string> = {
  primary: 'bg-brand active:bg-brand-pressed',
  secondary: 'border border-border bg-card active:bg-brand-subtle',
  ghost: 'active:bg-brand-subtle',
  danger: 'bg-danger active:opacity-90',
  whatsapp: 'bg-[#1F7A4D] active:bg-[#17603C]',
};
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-touch px-3',
  md: 'h-12 px-4',
  lg: 'h-14 px-6',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const { colors, scheme } = useUi();
  const onFill =
    variant === 'secondary' || variant === 'ghost'
      ? null
      : variant === 'whatsapp' || scheme === 'light'
        ? '#FFFFFF'
        : colors.surfacePage;
  const fg = onFill ?? (variant === 'ghost' ? colors.brandPrimary : colors.textPrimary);
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      className={cn(
        'min-h-touch flex-row items-center justify-center gap-2 rounded-md',
        BOX[variant],
        SIZE[size],
        block && 'w-full',
        off && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <View>{icon}</View> : null}
      <Text
        variant={size === 'sm' ? 'caption' : 'body'}
        weight="medium"
        tone="inherit"
        style={{ color: fg }}
        numberOfLines={1}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export interface IconButtonProps extends Omit<PressableProps, 'children'> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      className={cn(
        'min-h-touch min-w-touch items-center justify-center rounded-md',
        BOX[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </Pressable>
  );
}
