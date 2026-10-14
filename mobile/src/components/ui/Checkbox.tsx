import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export function Checkbox({ checked, onToggle, label, error }: { checked: boolean; onToggle: () => void; label: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.row}>
        <View style={[styles.box, checked && styles.on, !!error && styles.err]}>
          {checked ? <Icon name="check" size={14} color="onAccent" /> : null}
        </View>
        <Text variant="caption" color="inkMuted" style={styles.label}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  err: { borderColor: colors.danger },
  label: { flex: 1 },
});
