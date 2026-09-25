import { cva } from 'class-variance-authority';

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
        sm: 'px-3 text-caption',
        md: 'h-12 px-4 text-body',
        lg: 'h-14 px-6 text-body',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
