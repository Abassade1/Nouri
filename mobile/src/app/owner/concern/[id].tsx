import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { Button, Card, Chip, Reveal, Screen, Text } from '@/components/ui';
import { visitsRepo, type FlagActionType, type FlagItem } from '@/features/visits/repo';
import { formatDateTime } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, space } from '@/theme/tokens';

/** What an owner sees when their carer raises a concern: the facts, and one-tap next steps. */
export default function OwnerConcern() {
  const { t } = useTranslation('visits');
  const { t: tp } = useTranslation('pets');
  const { language } = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [flag, setFlag] = useState<FlagItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try { setFlag(await visitsRepo.getFlag(id)); } catch { setFlag(null); }
    setLoaded(true);
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!flag) return <Screen><BackLink />{loaded ? <Text color="inkMuted">{t('flag.notFound')}</Text> : null}</Screen>;

  const did = (a: FlagActionType) => flag.actions.some((x) => x.action === a);
  const resolved = did('resolved');

  const act = async (action: FlagActionType, after?: () => Promise<void> | void) => {
    setBusy(action); setError(false);
    try {
      await visitsRepo.addFlagAction(flag.id, action);
      await after?.();
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const urgent = flag.severity === 'urgent';

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <Text variant="title" auto>{t('flag.title', { pet: flag.pet_name })}</Text>
        <View style={styles.chips}>
          <Chip tone={urgent ? 'danger' : 'neutral'} label={tp(`history.severity.${flag.severity}`)} />
          <Chip label={tp(`history.categories.${flag.category}`)} />
          {resolved ? <Chip tone="accent" label={tp('history.flagActions.resolved')} /> : null}
        </View>
        <Text variant="caption" color="inkFaint" style={{ marginTop: space.sm }}>{t('flag.raised', { date: formatDateTime(flag.created_at, language) })}</Text>
      </Reveal>

      <View style={styles.sections}>
        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('flag.notes')}</Text>
          <Card><Text auto>{flag.notes}</Text></Card>
          {flag.photo_urls.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {flag.photo_urls.map((u) => <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" />)}
            </ScrollView>
          ) : null}
        </View>

        {!resolved ? (
          <View style={{ gap: space.sm }}>
            <Text variant="heading">{t('flag.next')}</Text>
            {flag.vet_phone ? (
              <Button icon="phone" label={t('flag.callVet')} loading={busy === 'called_vet'} onPress={() => act('called_vet', () => Linking.openURL(`tel:${flag.vet_phone}`))} />
            ) : (
              <Text variant="caption" color="inkMuted">{t('flag.noVet', { pet: flag.pet_name })}</Text>
            )}
            <Button
              variant="secondary" icon="truck" label={t('flag.bookTaxi')}
              onPress={() => router.push({ pathname: '/owner/discover', params: { service: 'pet_taxi', flag: flag.id } })}
            />
            {!did('acknowledged') ? <Button variant="secondary" icon="check" label={t('flag.acknowledge')} loading={busy === 'acknowledged'} onPress={() => act('acknowledged')} /> : null}
            <Button variant="ghost" label={t('flag.resolve')} loading={busy === 'resolved'} onPress={() => act('resolved')} />
            {error ? <Text variant="caption" color="danger">{t('flag.actionError')}</Text> : null}
          </View>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('flag.done')}</Text>
          {flag.actions.length === 0 ? <Text color="inkFaint">{t('flag.none')}</Text> : flag.actions.map((a) => (
            <Card key={a.id}>
              <Text variant="bodyStrong">{tp(`history.flagActions.${a.action}`)}</Text>
              <Text variant="caption" color="inkFaint">{formatDateTime(a.created_at, language)}</Text>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  sections: { gap: space.xl, marginTop: space.xl },
  photo: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.sunken },
});
