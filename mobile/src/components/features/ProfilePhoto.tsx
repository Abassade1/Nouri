import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { pickSquarePhoto } from '@/features/media/pick';
import { publicUrl } from '@/features/media/repo';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

import { Icon, Text } from '../ui';

const SIZE = 88;

/** The signed-in person's photo with a camera badge; tapping it picks and uploads a new one. */
export function ProfilePhoto() {
  const { t } = useTranslation('account');
  const { profile, setAvatar } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = publicUrl('avatars', profile?.avatar_path);
  const initial = (profile?.full_name ?? '?').trim().charAt(0).toUpperCase();

  const change = async () => {
    const image = await pickSquarePhoto();
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      await setAvatar(image);
    } catch {
      setError(t('photo.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={change} disabled={busy} accessibilityRole="button" accessibilityLabel={url ? t('photo.change') : t('photo.add')}>
        <View style={styles.avatar}>
          {url ? (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <Text variant="display" color="accent">{initial}</Text>
          )}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.onAccent} />
            </View>
          ) : null}
        </View>
        <View style={styles.badge}>
          <Icon name="camera" size={14} color="onAccent" />
        </View>
      </Pressable>
      <View style={styles.text}>
        <Pressable onPress={change} disabled={busy} hitSlop={8} accessibilityRole="button">
          <Text variant="bodyStrong" color="accent">{url ? t('photo.change') : t('photo.add')}</Text>
        </Pressable>
        <Text variant="caption" color={error ? 'danger' : 'inkMuted'}>{error ?? t('photo.hint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
  busy: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
