import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { publicUrl } from '@/features/media/repo';
import { colors } from '@/theme/tokens';

import { Text } from '../ui';

export function CarerAvatar({ name, path, size = 56 }: { name: string | null; path: string | null; size?: number }) {
  const url = publicUrl('avatars', path);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text variant={size > 80 ? 'display' : 'heading'} color="accent">
          {(name ?? '?').trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
