import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { ServiceInfo } from '@/features/marketplace/types';
import { photos, serviceImage } from '@/features/media/serviceImages';
import { localized } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, layout, radius, shadow, space } from '@/theme/tokens';

import { Icon, Text } from '../ui';

/**
 * A horizontal row of photo cards for picking a service. `allLabel` adds a first card
 * that clears the choice (value null).
 */
export function ServiceCards({ services, selected, onSelect, allLabel }: {
  services: ServiceInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}) {
  const { language } = useLocale();
  const items: { id: string | null; label: string; source: ReturnType<typeof serviceImage> }[] = [
    ...(allLabel ? [{ id: null, label: allLabel, source: photos.authBanner }] : []),
    ...services.map((s) => ({ id: s.id, label: localized(s.name_i18n, language), source: serviceImage(s) })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
      {items.map((item) => {
        const on = item.id === selected;
        return (
          <Pressable
            key={item.id ?? 'all'}
            onPress={() => onSelect(item.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            style={[styles.card, on && styles.cardOn]}
          >
            <Image source={item.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            <View style={styles.scrim} />
            {on ? (
              <View style={styles.check}>
                <Icon name="check" size={12} color="onAccent" />
              </View>
            ) : null}
            <Text variant="bodyStrong" color="onAccent" numberOfLines={2} style={styles.label}>
              {item.label}
            </Text>
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
  card: {
    width: 132,
    height: 164,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.sunken,
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.card,
  },
  cardOn: { borderColor: colors.highlight },
  scrim: { position: 'absolute', start: 0, end: 0, bottom: 0, height: '60%', backgroundColor: colors.overlay },
  check: {
    position: 'absolute',
    top: space.sm,
    end: space.sm,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { padding: space.md, fontSize: 14, lineHeight: 19 },
});
