import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, space } from '@/theme/tokens';

/**
 * Full-bleed deep-forest panel with a curved lower edge. It runs under the status bar,
 * so place it at the very top of a screen that is not wrapped in <Screen>.
 * An optional photo sits under a deep-green wash; soft rings add depth either way.
 */
export function HeroHeader({ children, style, image }: { children: ReactNode; style?: StyleProp<ViewStyle>; image?: ImageSource | number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + space.xl }, style]}>
      {image ? (
        <>
          <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={300} accessible={false} />
          <View pointerEvents="none" style={styles.scrim} />
        </>
      ) : null}
      <View pointerEvents="none" style={[styles.ring, styles.ringLarge]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringSmall]} />
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

/** Small frosted pill for the hero, e.g. a trust line. */
export function HeroBadge({ children }: { children: ReactNode }) {
  return (
    <View style={styles.badge}>
      <View style={styles.badgeDot} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.accent,
    borderBottomLeftRadius: radius.xl + 8,
    borderBottomRightRadius: radius.xl + 8,
    paddingBottom: space.xxxl,
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
  },
  scrim: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.heroScrim },
  ring: { position: 'absolute', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accentLine },
  ringLarge: { width: 420, height: 420, top: -140, end: -180 },
  ringSmall: { width: 260, height: 260, top: -60, end: -100 },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: radius.pill,
    bottom: -170,
    start: -90,
    backgroundColor: colors.highlight,
    opacity: 0.18,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentFill,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.highlightOnAccent },
});
