import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Icon } from './Icon';

/** A short rounded photo strip with the brand heart, for the top of focused screens (sign in, sign up). */
export function PhotoBanner({ source, height = 150 }: { source: ImageSource | number; height?: number }) {
  return (
    <View style={[styles.banner, { height }]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      <View style={styles.scrim} />
      <View style={styles.badge}>
        <Icon name="heart" size={16} color="onAccent" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.accent, marginTop: space.md, marginBottom: space.xl, ...shadow.card },
  scrim: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.accent, opacity: 0.18 },
  badge: {
    position: 'absolute',
    bottom: space.md,
    start: space.md,
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
