import * as T from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, SearchX, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
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

export function InlineAlert({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children: ReactNode; action?: ReactNode }) {
  const { cls, Icon } = TONE[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3', cls)}>
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
export function EmptyState({ title, body, action, icon }: { title?: string; body: string; action?: ReactNode; icon?: ReactNode }) {
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

export function ErrorState({ body, onRetry, requestId }: { body: string; onRetry?: () => void; requestId?: string }) {
  const { t } = useUi();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-8 text-center">
      <XCircle aria-hidden className="size-10 text-danger" strokeWidth={1.5} />
      <h2 className="text-h2">{t.errorTitle}</h2>
      <p className="max-w-md text-fg-secondary">{body}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t.retry}
        </Button>
      ) : null}
      {requestId ? <p className="text-label text-fg-secondary" dir="ltr">{`ref ${requestId}`}</p> : null}
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const push = useCallback((m: Omit<ToastMsg, 'id'>) => setItems((x) => [...x, { ...m, id: Date.now() + Math.random() }]), []);
  const { dir, t } = useUi();
  return (
    <ToastCtx.Provider value={push}>
      <T.Provider swipeDirection={dir === 'rtl' ? 'left' : 'right'} duration={6000} label={t.close}>
        {children}
        {items.map((m) => {
          const { cls, Icon } = TONE[m.tone];
          return (
            <T.Root key={m.id} onOpenChange={(o) => !o && setItems((x) => x.filter((i) => i.id !== m.id))} className={cn('flex items-center gap-3 rounded-md border bg-card p-3 shadow-2', cls)}>
              <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
              <T.Description className="flex-1">{m.text}</T.Description>
              {m.action ? (
                <T.Action altText={m.action.label} asChild>
                  <Button size="sm" variant="ghost" onClick={m.action.onClick}>
                    {m.action.label}
                  </Button>
                </T.Action>
              ) : null}
            </T.Root>
          );
        })}
        <T.Viewport className="fixed bottom-4 start-1/2 z-toast flex w-[min(100vw-2rem,28rem)] -translate-x-1/2 flex-col gap-2 rtl:translate-x-1/2" />
      </T.Provider>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
