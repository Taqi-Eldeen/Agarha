'use client';
import { AlertTriangle, CheckCircle2, Info, SearchX, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Button } from './button';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const TONE: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: 'border-info/40 bg-info/10 text-fg', Icon: Info },
  success: { cls: 'border-available/40 bg-available/10 text-fg', Icon: CheckCircle2 },
  warning: { cls: 'border-stale/40 bg-stale/10 text-fg', Icon: AlertTriangle },
  danger: { cls: 'border-danger/40 bg-danger/10 text-fg', Icon: XCircle },
};

export function InlineAlert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { cls, Icon } = TONE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border p-3', cls)}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="flex flex-1 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-caption">{children}</div>
        {action}
      </div>
    </div>
  );
}

/** Every empty state suggests a next action. */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title?: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const { t } = useUi();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
      {icon ?? <SearchX aria-hidden className="size-10 text-fg-secondary" strokeWidth={1.5} />}
      <h2 className="text-h2">{title ?? t.emptyTitle}</h2>
      <p className="max-w-md text-fg-secondary">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  body,
  onRetry,
  requestId,
}: {
  body: string;
  onRetry?: () => void;
  requestId?: string;
}) {
  const { t } = useUi();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-8 text-center"
    >
      <XCircle aria-hidden className="size-10 text-danger" strokeWidth={1.5} />
      <h2 className="text-h2">{t.errorTitle}</h2>
      <p className="max-w-md text-fg-secondary">{body}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t.retry}
        </Button>
      ) : null}
      {requestId ? (
        <p className="text-label text-fg-secondary" dir="ltr">{`ref ${requestId}`}</p>
      ) : null}
    </div>
  );
}

interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}
const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => undefined);
const TOAST_MS = 6000;

/**
 * Lightweight toasts: a polite live region (assertive for errors), auto-dismiss after 6s,
 * paused while hovered or focused so the Undo action stays reachable. No dependency.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const remove = useCallback((id: number) => setItems((x) => x.filter((i) => i.id !== id)), []);
  const push = useCallback(
    (m: Omit<ToastMsg, 'id'>) =>
      setItems((x) => [...x.slice(-2), { ...m, id: Date.now() + Math.random() }]),
    [],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-toast flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]"
      >
        {items.map((m) => (
          <ToastItem key={m.id} msg={m} onDone={() => remove(m.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const { t } = useUi();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [paused, onDone]);
  const { cls, Icon } = TONE[msg.tone];
  return (
    <div
      role={msg.tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md border bg-card p-3 shadow-2',
        cls,
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
      <p className="flex-1">{msg.text}</p>
      {msg.action ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            msg.action!.onClick();
            onDone();
          }}
        >
          {msg.action.label}
        </Button>
      ) : null}
      <button
        type="button"
        onClick={onDone}
        aria-label={t.close}
        className="inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-subtle"
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastCtx);
