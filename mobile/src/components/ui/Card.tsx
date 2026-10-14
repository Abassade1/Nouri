import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

export function Card({ children, style, soft }: { children: ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[styles.card, soft && styles.soft, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.xl,
    gap: space.sm,
  },
  soft: { backgroundColor: colors.sunken, borderColor: 'transparent' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, alignSelf: 'stretch' },
});
