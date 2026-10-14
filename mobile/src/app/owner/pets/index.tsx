import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PetAvatar } from '@/components/features/pets/PetAvatar';
import { formatAge } from '@/components/features/pets/format';
import { Button, Chip, EmptyState, Icon, Reveal, Screen, ScreenTitle, Text } from '@/components/ui';
import { usePets } from '@/features/pets/hooks';
import { colors, radius, shadow, space } from '@/theme/tokens';

export default function PetsList() {
  const { t } = useTranslation('pets');
  const router = useRouter();
  const pets = usePets();

  return (
    <Screen edges={['top']} footer={pets && pets.length > 0 ? <Button icon="plus" label={t('list.add')} onPress={() => router.push('/owner/pets/new')} /> : undefined}>
      <ScreenTitle title={t('list.title')} />
      {pets && pets.length === 0 ? (
        <>
          <EmptyState icon="heart" title={t('list.emptyTitle')} body={t('list.emptyBody')} />
          <Button icon="plus" label={t('list.add')} onPress={() => router.push('/owner/pets/new')} />
        </>
      ) : null}
      <View style={styles.list}>
        {pets?.map((pet, i) => (
          <Reveal key={pet.id} delay={i * 60}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/owner/pets/[id]', params: { id: pet.id } })}
              style={styles.row}
            >
              <PetAvatar name={pet.name} photoPath={pet.photo_path} size={64} />
              <View style={styles.info}>
                <Text variant="heading" auto>{pet.name}</Text>
                <Text variant="caption" color="inkMuted" auto>
                  {[pet.breed || t(`species.${pet.species}`), formatAge(pet.birth_date, t)].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.tags}>
                  {pet.tags.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={t(`tags.${tag}`)} tone={tag === 'healthy' ? 'accent' : 'neutral'} />
                  ))}
                </View>
              </View>
              <Icon name="chevron-right" size={18} color="inkFaint" directional />
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card,
  },
  info: { flex: 1, gap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 2 },
});
