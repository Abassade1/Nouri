import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Text } from './Text';

type Tone = 'neutral' | 'accent' | 'danger';

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.chip, tone === 'accent' && styles.accent, tone === 'danger' && styles.danger]}>
      <Text variant="caption" color={tone === 'accent' ? 'highlight' : tone === 'danger' ? 'danger' : 'inkMuted'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.sunken,
  },
  accent: { backgroundColor: colors.highlightSoft },
  danger: { backgroundColor: colors.dangerSoft },
});
