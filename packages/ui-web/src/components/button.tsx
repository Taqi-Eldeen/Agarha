'use client';
import { Slot } from '@radix-ui/react-slot';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from './button-variants';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
  icon?: ReactNode;
}

export { buttonVariants };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, asChild, icon, children, disabled, ...props },
  ref,
) {
  const { t } = useUi();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-5 animate-spin" strokeWidth={1.75} /> : icon}
      {loading ? <span className="sr-only">{t.loading}</span> : null}
      {asChild ? children : <span>{children}</span>}
    </Comp>
  );
});

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  /** Required: the accessible name (icons alone are not announced). */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'secondary' | 'primary';
  shape?: 'square' | 'round';
}

const ICON_VARIANT = {
  ghost: 'text-brand hover:bg-brand-subtle',
  secondary: 'border border-border bg-card text-fg hover:bg-brand-subtle',
  primary: 'bg-brand text-white hover:bg-brand-pressed dark:text-page',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', shape = 'square', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50',
        shape === 'round' ? 'rounded-full' : 'rounded-md',
        ICON_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
