import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 min-h-touch',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-pressed dark:text-page',
        secondary: 'border border-border bg-card text-fg hover:bg-brand-subtle',
        ghost: 'text-brand hover:bg-brand-subtle',
        danger: 'bg-danger text-white hover:opacity-90 dark:text-page',
        // WhatsApp green is a brand colour of WhatsApp, used only on the WhatsApp action.
        whatsapp: 'bg-[#1F7A4D] text-white hover:bg-[#17603C]',
      },
      size: {
        sm: 'h-9 px-3 text-caption min-h-0',
        md: 'h-12 px-4 text-body',
        lg: 'h-14 px-6 text-body',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, block, loading, asChild, icon, children, disabled, ...props }, ref) {
  const { t } = useUi();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 aria-hidden className="size-5 animate-spin" strokeWidth={1.75} /> : icon}
      {loading ? <span className="sr-only">{t.loading}</span> : null}
      {asChild ? children : <span>{children}</span>}
    </Comp>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: the accessible name (icons alone are not announced). */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'secondary' | 'primary';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, icon, variant = 'ghost', className, ...props }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cn(buttonVariants({ variant, size: 'md' }), 'size-12 px-0', className)} {...props}>
      {icon}
    </button>
  );
});
