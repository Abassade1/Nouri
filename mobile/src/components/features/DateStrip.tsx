import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { formatCalendarDate } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, space } from '@/theme/tokens';

import { Text } from '../ui';

/** Horizontally scrolling days: weekday above, day number below. `null` value = "any day". */
export function DateStrip({ dates, selected, onSelect, anyLabel }: {
  dates: string[]; selected: string | null; onSelect: (date: string | null) => void; anyLabel?: string;
}) {
  const { language } = useLocale();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {anyLabel ? (
        <Pressable onPress={() => onSelect(null)} style={[styles.chip, selected === null && styles.on]} accessibilityRole="button" accessibilityState={{ selected: selected === null }}>
          <Text variant="caption" color={selected === null ? 'onAccent' : 'ink'}>{anyLabel}</Text>
        </Pressable>
      ) : null}
      {dates.map((d) => {
        const on = d === selected;
        return (
          <Pressable key={d} onPress={() => onSelect(d)} style={[styles.chip, styles.day, on && styles.on]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text variant="overline" color={on ? 'onAccent' : 'inkMuted'}>{formatCalendarDate(d, language, { weekday: 'short' })}</Text>
            <Text variant="bodyStrong" color={on ? 'onAccent' : 'ink'}>{formatCalendarDate(d, language, { day: 'numeric' })}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  day: { minWidth: 56, borderRadius: radius.md, paddingVertical: space.sm },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
});
