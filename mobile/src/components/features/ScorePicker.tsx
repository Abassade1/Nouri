import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Text } from '../ui';

/** Five tappable numbers, 1 (poor) to 5 (excellent). */
export function ScorePicker({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        return (
          <Pressable key={n} onPress={() => onChange(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label} ${n}`} style={[styles.dot, on && styles.on]}>
            <Text variant="bodyStrong" color={on ? 'onAccent' : 'ink'}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  dot: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
});
