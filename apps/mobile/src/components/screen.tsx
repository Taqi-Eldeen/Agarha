import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/** Page shell: token background, safe areas, optional scroll with the standard 16px gutter. */
export function Screen({ children, scroll = true, edges = ['top'], footer, ...props }: { children: ReactNode; scroll?: boolean; edges?: Edge[]; footer?: ReactNode } & ScrollViewProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-page">
      {scroll ? (
        <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4" keyboardShouldPersistTaps="handled" {...props}>
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
