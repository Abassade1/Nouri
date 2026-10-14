import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PickedImage } from '@/features/pets/repo';
import { colors, radius, space } from '@/theme/tokens';

import { Button, Icon, Text } from '../ui';

const MAX = 6;

/** Add up to six photos and remove any before sending. */
export function PhotoPicker({ photos, onChange }: { photos: PickedImage[]; onChange: (p: PickedImage[]) => void }) {
  const { t } = useTranslation('visits');

  const add = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX - photos.length, quality: 0.7,
    });
    if (res.canceled) return;
    const next = [...photos, ...res.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }))].slice(0, MAX);
    onChange(next);
  };

  return (
    <View style={{ gap: space.sm }}>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((p, i) => (
            <View key={p.uri + i} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable onPress={() => onChange(photos.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('report.removePhoto')} style={styles.remove}>
                <Icon name="x" size={14} color="onAccent" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {photos.length < MAX ? <Button variant="secondary" icon="camera" label={t('report.addPhotos')} onPress={add} /> : null}
      <Text variant="caption" color="inkFaint">{t('report.photoLimit')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sunken },
  remove: { position: 'absolute', top: 4, end: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(29,28,25,0.7)', alignItems: 'center', justifyContent: 'center' },
});
