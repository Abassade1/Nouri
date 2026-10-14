import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

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
    padding: space.xl,
    gap: space.sm,
    ...shadow.card,
  },
  soft: { backgroundColor: colors.sunken, shadowOpacity: 0, elevation: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, alignSelf: 'stretch' },
});
