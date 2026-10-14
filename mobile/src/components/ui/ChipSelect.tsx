import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Text } from './Text';

type Option = { value: string; label: string };

/** Tappable pills. `multiple` toggles several values; otherwise picking one replaces the selection. */
export function ChipSelect({ options, selected, onChange, multiple = false, scroll = false }: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  /** One horizontally scrolling row instead of wrapping onto several lines. */
  scroll?: boolean;
}) {
  const toggle = (value: string) => {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.scrollRow } : { style: styles.wrap };
  return (
    <Wrapper {...(wrapperProps as object)}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ selected: on, checked: on }}
            style={[styles.chip, on && styles.on]}
          >
            <Text variant="caption" color={on ? 'onAccent' : 'ink'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scrollRow: { flexDirection: 'row', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
});
