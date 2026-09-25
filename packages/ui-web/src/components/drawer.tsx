'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** bottom on phones (filter sheet), side on desktop. */
  side?: 'bottom' | 'end';
}

/** Web counterpart of the native BottomSheet (same name in Figma: "Drawer"). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'bottom',
}: DrawerProps) {
  const { t, dir } = useUi();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-fg/40" />
        <Dialog.Content
          dir={dir}
          className={cn(
            'fixed z-modal flex flex-col bg-card shadow-3 focus:outline-none',
            side === 'bottom'
              ? 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg'
              : 'inset-y-0 end-0 w-full max-w-md',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <Dialog.Title className="text-h2">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={t.close}
              className="inline-flex size-12 items-center justify-center rounded-md hover:bg-brand-subtle"
            >
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="px-4 pt-2 text-caption text-fg-secondary">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Modal(props: Omit<DrawerProps, 'side'>) {
  return <Drawer {...props} side="end" />;
}
