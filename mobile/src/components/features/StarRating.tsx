import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { Icon } from '../ui';

/** Tap-to-rate stars (1 to 5). Read-only when `onChange` is omitted. */
export function StarRating({ value, onChange, size = 28, label }: { value: number; onChange?: (n: number) => void; size?: number; label?: string }) {
  return (
    <View style={styles.row} accessibilityRole={onChange ? 'radiogroup' : 'image'} accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = <Icon name="star" size={size} color={filled ? 'accent' : 'inkFaint'} style={filled ? undefined : { opacity: 0.45 }} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ selected: n === value }} accessibilityLabel={`${n}`}>
            {star}
          </Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: space.sm } });
