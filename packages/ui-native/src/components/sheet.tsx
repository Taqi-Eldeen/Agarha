import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '../lib/ui-context';
import { IconButton } from './button';
import { Text } from './text';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet (filters, report, date request). Same name and props as the web Drawer. */
export function Drawer({ open, onOpenChange, title, children, footer }: SheetProps) {
  const { t, colors, dir } = useUi();
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={() => onOpenChange(false)} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} className="flex-1 bg-black/40" onPress={() => onOpenChange(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="max-h-[90%] rounded-t-lg bg-card" style={{ direction: dir }}>
        <View accessibilityRole="header" className="flex-row items-center justify-between border-b border-border px-4 py-2">
          <Text variant="h2">{title}</Text>
          <IconButton label={t.close} icon={<X size={24} color={colors.textPrimary} strokeWidth={1.75} />} onPress={() => onOpenChange(false)} />
        </View>
        <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View className="border-t border-border p-4" style={{ paddingBottom: Math.max(16, insets.bottom) }}>{footer}</View> : <View style={{ height: insets.bottom }} />}
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** Centred dialog for confirmations (account deletion, sign-out). */
export function Modal({ open, onOpenChange, title, children, footer }: SheetProps) {
  const { dir } = useUi();
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)} statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/40 p-4">
        <View accessibilityViewIsModal className="w-full max-w-md gap-4 rounded-lg bg-card p-4" style={{ direction: dir }}>
          <Text variant="h2" accessibilityRole="header">{title}</Text>
          {children}
          {footer}
        </View>
      </View>
    </RNModal>
  );
}
