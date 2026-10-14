import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Bottom edge is handled by the tab bar inside tabs; keep it for stand-alone screens. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned to the bottom (e.g. a primary button). */
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, edges = ['top', 'bottom'], contentStyle, footer }: Props) {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{inner}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: space.xxl },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space.xl,
  },
  footer: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingBottom: space.lg,
    paddingTop: space.md,
  },
});
