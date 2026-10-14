import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SPECIES, SPECIES_ICON } from '@/features/pets/species';
import type { PetSpecies } from '@/types/pets';
import { colors, layout, radius, shadow, space } from '@/theme/tokens';

import { Text } from '../ui';

/**
 * A horizontal row of round animal tiles. With `onSelect` it works as a single-choice
 * picker (`allLabel` adds an "All" tile); with `onPress` each tile is a shortcut.
 */
export function SpeciesPicker({ selected = null, onSelect, onPress, allLabel }: {
  selected?: PetSpecies | null;
  onSelect?: (species: PetSpecies | null) => void;
  onPress?: (species: PetSpecies) => void;
  allLabel?: string;
}) {
  const { t } = useTranslation('pets');
  const items: { value: PetSpecies | null; label: string; icon: string }[] = [
    ...(allLabel ? [{ value: null, label: allLabel, icon: 'paw' }] : []),
    ...SPECIES.filter((s) => s !== 'other').map((s) => ({ value: s, label: t(`species.${s}`), icon: SPECIES_ICON[s] })),
  ];
  const picker = !!onSelect;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row} accessibilityRole={picker ? 'radiogroup' : undefined}>
      {items.map((item) => {
        const on = picker && item.value === selected;
        return (
          <Pressable
            key={item.value ?? 'all'}
            onPress={() => (picker ? onSelect?.(item.value) : item.value && onPress?.(item.value))}
            accessibilityRole={picker ? 'radio' : 'button'}
            accessibilityState={picker ? { selected: on } : undefined}
            accessibilityLabel={item.label}
            style={styles.item}
          >
            <View style={[styles.tile, on && styles.tileOn]}>
              <MaterialCommunityIcons name={item.icon as never} size={26} color={on ? colors.onAccent : colors.accent} />
            </View>
            <Text variant="caption" color={on ? 'accent' : 'inkMuted'} numberOfLines={1} align="center">{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Runs to the screen edges; the first item still lines up with the page margin.
  bleed: { marginHorizontal: -layout.gutter },
  row: { gap: space.md, paddingVertical: space.sm, paddingHorizontal: layout.gutter },
  item: { width: 72, alignItems: 'center', gap: space.xs },
  tile: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  tileOn: { backgroundColor: colors.accent },
});
