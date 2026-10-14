import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Reveal, Screen, Text } from '../../ui';
import { BackLink } from '../BackLink';
import { HistorySection } from './HistorySection';
import { MedicationsSection } from './MedicationsSection';
import { PetAvatar } from './PetAvatar';
import { WellbeingSection } from './WellbeingSection';
import { formatAge } from './format';
import { usePetDetail } from '@/features/pets/hooks';
import { space } from '@/theme/tokens';
import type { PetTag } from '@/types/pets';

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="overline" color="inkFaint">{label}</Text>
      <Text auto>{value}</Text>
    </View>
  );
}

/** The full pet profile. Owners edit it; carers on a confirmed booking see the same thing read-only. */
export function PetProfileView({ petId, readOnly = false }: { petId: string; readOnly?: boolean }) {
  const { t } = useTranslation('pets');
  const router = useRouter();
  const { detail, loaded, refresh } = usePetDetail(petId);

  if (!detail) {
    return <Screen><BackLink />{loaded ? <Text color="inkMuted">{t('errors.generic')}</Text> : null}</Screen>;
  }
  const { pet, health, medications, wellbeing, history } = detail;
  const tags: PetTag[] = [...pet.tags];
  if (medications.some((m) => m.is_active) && !tags.includes('on_medication')) tags.push('on_medication');
  const hasHealth = health.medical_notes || health.allergies.length || health.microchip_id || health.insurance_status !== 'unknown' || health.vet_clinic;

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <View style={styles.hero}>
          <PetAvatar name={pet.name} photoPath={pet.photo_path} size={96} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" auto>{pet.name}</Text>
            <Text color="inkMuted" auto>
              {[pet.breed || t(`species.${pet.species}`), pet.sex !== 'unknown' ? t(`sex.${pet.sex}`) : null, formatAge(pet.birth_date, t), pet.weight_kg ? t('detail.weight', { kg: pet.weight_kg }) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={styles.tags}>
          {tags.map((tag) => <Chip key={tag} label={t(`tags.${tag}`)} tone={tag === 'healthy' ? 'accent' : 'neutral'} />)}
        </View>
        {!readOnly ? <Button variant="secondary" icon="edit-2" label={t('detail.edit')} onPress={() => router.push({ pathname: '/owner/pets/[id]/edit', params: { id: pet.id } })} style={{ marginTop: space.lg }} /> : null}
      </Reveal>

      <View style={styles.sections}>
        <WellbeingSection points={wellbeing} />

        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('detail.routine')}</Text>
          <Card>
            <Fact label={t('detail.behaviour')} value={pet.behaviour_notes} />
            <Fact label={t('detail.feeding')} value={pet.feeding_routine} />
            <Fact label={t('detail.walking')} value={pet.walking_routine} />
            <Fact label={t('detail.quirks')} value={pet.quirks} />
            {!pet.behaviour_notes && !pet.feeding_routine && !pet.walking_routine && !pet.quirks ? <Text color="inkFaint">{t('detail.none')}</Text> : null}
          </Card>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('detail.health')}</Text>
          <Card>
            {hasHealth ? (
              <>
                <Fact label={t('detail.medicalNotes')} value={health.medical_notes} />
                <Fact label={t('detail.allergies')} value={health.allergies.join(', ')} />
                <Fact label={t('detail.microchip')} value={health.microchip_id} />
                <Fact
                  label={t('detail.insurance')}
                  value={health.insurance_status === 'unknown' ? null : [t(`insurance.${health.insurance_status}`), health.insurance_provider].filter(Boolean).join(' · ')}
                />
                <Fact label={t('detail.vet')} value={[health.vet_clinic, health.vet_name].filter(Boolean).join(' · ')} />
                {health.vet_phone ? <Button variant="secondary" icon="phone" label={t('detail.callVet')} onPress={() => void Linking.openURL(`tel:${health.vet_phone}`)} /> : null}
              </>
            ) : (
              <Text color="inkFaint">{t('detail.none')}</Text>
            )}
          </Card>
        </View>

        <MedicationsSection petId={pet.id} medications={medications} onChange={refresh} readOnly={readOnly} />
        <HistorySection petId={pet.id} events={history} onChange={refresh} readOnly={readOnly} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.lg },
  sections: { gap: space.xxl, marginTop: space.xxl },
});
