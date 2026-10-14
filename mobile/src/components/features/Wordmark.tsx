import { StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { colors, radius, space } from '@/theme/tokens';

import { Icon, Text } from '../ui';

/**
 * The working brand mark: a leaf-green tile with a heart, beside the name.
 * `light` is for the deep-forest hero. Replace with the final logo later.
 */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={styles.tile}>
        <Icon name="heart" size={16} color="onAccent" />
      </View>
      <Text style={[styles.text, { color: light ? colors.onAccent : colors.accent }]}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  tile: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, letterSpacing: 4, textTransform: 'uppercase' },
});
