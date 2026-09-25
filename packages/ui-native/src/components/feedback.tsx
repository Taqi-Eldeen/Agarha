import { AlertTriangle, CheckCircle2, Info, SearchX, XCircle } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Button } from './button';
import { Text } from './text';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const TONE: Record<
  Tone,
  {
    cls: string;
    Icon: typeof Info;
    color: 'statusInfo' | 'statusAvailable' | 'statusStale' | 'statusDanger';
  }
> = {
  info: { cls: 'border-info/40 bg-info/10', Icon: Info, color: 'statusInfo' },
  success: {
    cls: 'border-available/40 bg-available/10',
    Icon: CheckCircle2,
    color: 'statusAvailable',
  },
  warning: { cls: 'border-stale/40 bg-stale/10', Icon: AlertTriangle, color: 'statusStale' },
  danger: { cls: 'border-danger/40 bg-danger/10', Icon: XCircle, color: 'statusDanger' },
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
  const { colors } = useUi();
  const { cls, Icon, color } = TONE[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      className={cn('flex-row gap-3 rounded-md border p-3', cls)}
    >
      <Icon size={20} color={colors[color]} strokeWidth={1.75} />
      <View className="flex-1 gap-1">
        {title ? <Text weight="semibold">{title}</Text> : null}
        {typeof children === 'string' ? <Text variant="caption">{children}</Text> : children}
        {action}
      </View>
    </View>
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
  const { t, colors } = useUi();
  return (
    <View className="items-center gap-3 rounded-lg border border-dashed border-border p-8">
      {icon ?? <SearchX size={40} color={colors.textSecondary} strokeWidth={1.5} />}
      <Text variant="h2" className="text-center">
        {title ?? t.emptyTitle}
      </Text>
      <Text tone="secondary" className="text-center">
        {body}
      </Text>
      {action}
    </View>
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
  const { t, colors } = useUi();
  return (
    <View
      accessibilityRole="alert"
      className="items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-8"
    >
      <XCircle size={40} color={colors.statusDanger} strokeWidth={1.5} />
      <Text variant="h2" className="text-center">
        {t.errorTitle}
      </Text>
      <Text tone="secondary" className="text-center">
        {body}
      </Text>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry}>
          {t.retry}
        </Button>
      ) : null}
      {requestId ? <Text variant="label" tone="secondary">{`ref ${requestId}`}</Text> : null}
    </View>
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

/** Toasts above the tab bar; announced to screen readers; auto-dismiss after 6s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const insets = useSafeAreaInsets();
  const remove = useCallback((id: number) => setItems((x) => x.filter((i) => i.id !== id)), []);
  const push = useCallback((m: Omit<ToastMsg, 'id'>) => {
    AccessibilityInfo.announceForAccessibility(m.text);
    setItems((x) => [...x.slice(-2), { ...m, id: Date.now() + Math.random() }]);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 items-center gap-2 px-4"
        style={{ bottom: insets.bottom + 72 }}
      >
        {items.map((m) => (
          <ToastItem key={m.id} msg={m} onDone={() => remove(m.id)} />
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

function ToastItem({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const { colors } = useUi();
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDone]);
  const { cls, Icon, color } = TONE[msg.tone];
  return (
    <View
      accessibilityRole={msg.tone === 'danger' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      className={cn(
        'w-full max-w-md flex-row items-center gap-3 rounded-md border bg-card p-3 shadow-md',
        cls,
      )}
    >
      <Icon size={20} color={colors[color]} strokeWidth={1.75} />
      <Text className="flex-1">{msg.text}</Text>
      {msg.action ? (
        <Button
          size="sm"
          variant="ghost"
          onPress={() => {
            msg.action!.onClick();
            onDone();
          }}
        >
          {msg.action.label}
        </Button>
      ) : null}
    </View>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
