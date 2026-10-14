import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

/** A large selectable card (used for choosing a role). */
export function OptionCard({ title, body, selected, onPress }: { title: string; body?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {body ? (
          <Text variant="caption" color="inkMuted">
            {body}
          </Text>
        ) : null}
      </View>
      <View style={[styles.dot, selected && styles.dotOn]}>{selected ? <Icon name="check" size={14} color="onAccent" /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft, shadowOpacity: 0, elevation: 0 },
  text: { flex: 1, gap: 2 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.highlight, borderColor: colors.highlight },
});
