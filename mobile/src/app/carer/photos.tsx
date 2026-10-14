import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { Button, Card, Chip, ChipSelect, EmptyState, Reveal, Screen, Text, TextField } from '@/components/ui';
import { applicationRepo, type OfferableService } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';
import { pickPhotos } from '@/features/media/pick';
import { MAX_CARER_PHOTOS, mediaRepo, publicUrl, type CarerPhoto } from '@/features/media/repo';
import { localized } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

const GENERAL = 'general';

/** A carer's public gallery: add, tag with a service, caption and remove photos. */
export default function CarerPhotos() {
  const { t } = useTranslation('carer');
  const { language } = useLocale();
  const { profile } = useAuth();
  const { data } = useApplication();
  const [photos, setPhotos] = useState<CarerPhoto[] | null>(null);
  const [services, setServices] = useState<OfferableService[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tag, setTag] = useState(GENERAL);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carerId = profile?.id;
  const cityId = data?.profile?.city_id ?? null;

  useEffect(() => {
    if (!carerId) return;
    mediaRepo.listCarerPhotos(carerId).then(setPhotos).catch(() => {
      setPhotos([]);
      setError(t('photos.error'));
    });
  }, [carerId, t]);

  // Only the services this carer offers can be used as tags.
  useEffect(() => {
    if (!cityId || !data) return;
    const offered = new Set(data.services.filter((s) => s.is_active).map((s) => s.service_id));
    void applicationRepo.listServicesForCity(cityId).then((list) => setServices(list.filter((s) => offered.has(s.id)))).catch(() => {});
  }, [cityId, data]);

  const count = photos?.length ?? 0;
  const remaining = MAX_CARER_PHOTOS - count;
  const serviceName = (id: string | null) => {
    const s = services.find((x) => x.id === id);
    return s ? localized(s.name_i18n, language) : null;
  };

  const add = async () => {
    if (!carerId) return;
    const picked = await pickPhotos(remaining);
    if (!picked.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const image of picked) {
        const photo = await mediaRepo.addCarerPhoto(carerId, image, null, null);
        setPhotos((prev) => [...(prev ?? []), photo]);
      }
    } catch {
      setError(t('photos.error'));
    } finally {
      setBusy(false);
    }
  };

  const open = (photo: CarerPhoto) => {
    if (selected === photo.id) return setSelected(null);
    setSelected(photo.id);
    setTag(photo.service_id ?? GENERAL);
    setCaption(photo.caption ?? '');
  };

  const save = async (photo: CarerPhoto) => {
    setBusy(true);
    setError(null);
    const changes = { service_id: tag === GENERAL ? null : tag, caption: caption.trim() || null };
    try {
      await mediaRepo.updateCarerPhoto(photo, changes);
      setPhotos((prev) => prev?.map((p) => (p.id === photo.id ? { ...p, ...changes } : p)) ?? null);
      setSelected(null);
    } catch {
      setError(t('photos.error'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (photo: CarerPhoto) => {
    Alert.alert(t('photos.removeTitle'), t('photos.removeBody'), [
      { text: t('photos.cancel'), style: 'cancel' },
      {
        text: t('photos.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await mediaRepo.removeCarerPhoto(photo);
            setPhotos((prev) => prev?.filter((p) => p.id !== photo.id) ?? null);
            setSelected(null);
          } catch {
            setError(t('photos.error'));
          }
        },
      },
    ]);
  };

  const editing = photos?.find((p) => p.id === selected) ?? null;

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <Text variant="title">{t('photos.title')}</Text>
        <Text color="inkMuted" style={styles.subtitle}>{t('photos.subtitle')}</Text>
        <View style={styles.countRow}>
          <Chip tone="accent" label={t('photos.count', { count, max: MAX_CARER_PHOTOS })} />
        </View>
      </Reveal>

      {photos && photos.length === 0 ? (
        <EmptyState icon="image" title={t('photos.emptyTitle')} body={t('photos.emptyBody')} />
      ) : null}

      <View style={styles.grid}>
        {photos?.map((p, i) => {
          const tagName = serviceName(p.service_id);
          return (
            <Pressable
              key={p.id}
              onPress={() => open(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === p.id }}
              accessibilityLabel={p.caption ?? tagName ?? t('photos.general')}
              style={[styles.tile, selected === p.id && styles.tileOn]}
            >
              <Image source={{ uri: publicUrl('carer-photos', p.path) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              {i === 0 ? (
                <View style={styles.cover}>
                  <Text variant="overline" color="onAccent">{t('photos.cover')}</Text>
                </View>
              ) : null}
              {tagName || p.caption ? (
                <View style={styles.scrim}>
                  {tagName ? <Text variant="caption" color="onAccent" numberOfLines={1}>{tagName}</Text> : null}
                  {p.caption ? <Text variant="caption" color="onAccentMuted" numberOfLines={1} auto>{p.caption}</Text> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {editing ? (
        <Card style={styles.editor}>
          <Text variant="bodyStrong">{t('photos.tagLabel')}</Text>
          <ChipSelect
            options={[{ value: GENERAL, label: t('photos.general') }, ...services.map((s) => ({ value: s.id, label: localized(s.name_i18n, language) }))]}
            selected={[tag]}
            onChange={(v) => setTag(v[0] ?? GENERAL)}
          />
          <TextField
            label={t('photos.caption')}
            placeholder={t('photos.captionPlaceholder')}
            value={caption}
            onChangeText={setCaption}
            maxLength={140}
          />
          <Button label={t('photos.save')} loading={busy} onPress={() => void save(editing)} />
          <Button variant="ghost" icon="trash-2" label={t('photos.remove')} onPress={() => remove(editing)} />
        </Card>
      ) : null}

      {error ? <Text color="danger" style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {remaining > 0 ? (
          <Button icon="camera" label={t('photos.add')} loading={busy && !editing} disabled={!photos} onPress={() => void add()} />
        ) : (
          <Text variant="caption" color="inkMuted" align="center">{t('photos.limit', { max: MAX_CARER_PHOTOS })}</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space.sm },
  countRow: { flexDirection: 'row', marginTop: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xl },
  tile: {
    width: '47.5%',
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.sunken,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.card,
  },
  tileOn: { borderColor: colors.highlight },
  cover: {
    position: 'absolute',
    top: space.sm,
    start: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  scrim: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: space.sm, backgroundColor: colors.overlay },
  editor: { marginTop: space.lg, gap: space.md },
  error: { marginTop: space.md },
  actions: { marginTop: space.xl },
});
