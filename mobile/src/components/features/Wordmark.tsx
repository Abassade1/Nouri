import { StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { colors, space } from '@/theme/tokens';

import { Text } from '../ui';

/** The working brand mark: spaced capitals over a hairline. Replace with the final logo later. */
export function Wordmark() {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.text}>{APP_NAME}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, alignItems: 'flex-start' },
  text: { fontSize: 15, letterSpacing: 5, textTransform: 'uppercase', color: colors.accent },
  rule: { width: 28, height: 1, backgroundColor: colors.accent },
});
