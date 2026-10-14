import * as ImagePicker from 'expo-image-picker';

import type { PickedImage } from '../pets/repo';

/** One square-cropped photo (profile pictures). Resolves null if the person cancels. */
export async function pickSquarePhoto(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' };
}

/** Several photos at once, up to `limit`. */
export async function pickPhotos(limit: number): Promise<PickedImage[]> {
  if (limit <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: 0.75,
  });
  if (res.canceled) return [];
  return res.assets.slice(0, limit).map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }));
}
