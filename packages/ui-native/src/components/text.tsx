import type { ReactNode } from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

type Variant = 'display' | 'h1' | 'h2' | 'price' | 'body' | 'caption' | 'label';
const SIZE: Record<Variant, string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  price: 'text-price',
  body: 'text-body',
  caption: 'text-caption',
  label: 'text-label',
};

/** Text with the locale's font family, token type scale and text/primary colour by default. */
export function Text({
  variant = 'body',
  weight,
  tone = 'primary',
  className,
  children,
  ...props
}: TextProps & {
  variant?: Variant;
  weight?: 'regular' | 'medium' | 'semibold';
  tone?: 'primary' | 'secondary' | 'brand' | 'danger' | 'inherit';
  className?: string;
  children?: ReactNode;
}) {
  const { font } = useUi();
  const w =
    weight ??
    (variant === 'h1' || variant === 'h2' || variant === 'price'
      ? 'semibold'
      : variant === 'label'
        ? 'medium'
        : 'regular');
  const color = {
    primary: 'text-fg',
    secondary: 'text-fg-secondary',
    brand: 'text-brand',
    danger: 'text-danger',
    inherit: '',
  }[tone];
  return (
    <RNText
      className={cn(
        SIZE[variant],
        variant === 'display' ? 'font-display' : font(w),
        color,
        'text-start',
        className,
      )}
      {...props}
    >
      {children}
    </RNText>
  );
}
