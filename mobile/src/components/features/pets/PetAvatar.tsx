import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { usePhotoUrl } from '@/features/pets/usePhotoUrl';
import { colors } from '@/theme/tokens';

import { Text } from '../../ui';

export function PetAvatar({ name, photoPath, size = 56 }: { name: string; photoPath: string | null; size?: number }) {
  const url = usePhotoUrl(photoPath);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={name} />
      ) : (
        <Text variant={size > 80 ? 'display' : 'heading'} color="accent">
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
