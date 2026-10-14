import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { PhotoPicker } from '@/components/features/PhotoPicker';
import { Button, ChipSelect, EmptyState, OptionCard, Text, TextField } from '@/components/ui';
import { useBooking } from '@/features/bookings/hooks';
import type { PickedImage } from '@/features/pets/repo';
import { visitsRepo, type Category, type Severity } from '@/features/visits/repo';
import { space } from '@/theme/tokens';

const CATEGORIES: Category[] = ['health', 'behaviour', 'other'];
const SEVERITIES: Severity[] = ['info', 'concern', 'urgent'];

export default function RaiseConcern() {
  const { t } = useTranslation('visits');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { booking } = useBooking(id);

  const [petId, setPetId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('health');
  const [severity, setSeverity] = useState<Severity>('concern');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => { if (booking && booking.pets.length === 1) setPetId(booking.pets[0].id); }, [booking]);

  if (!booking) return <FormScreen title={t('concern.title')}><View /></FormScreen>;

  const submit = async () => {
    setError(null);
    if (!petId || !notes.trim()) return setError(t('concern.required'));
    setBusy(true);
    try {
      await visitsRepo.raiseFlag({ bookingId: booking.id, petId, category, severity, notes, photos });
      setSent(true);
    } catch {
      setError(t('visit.actionError'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <FormScreen title="" footer={<Button label={t('report.back')} onPress={() => router.back()} />}>
        <EmptyState icon="bell" title={t('concern.sentTitle')} body={t('concern.sentBody')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('concern.title')}
      intro={t('concern.intro')}
      footer={<View style={{ gap: space.sm }}>{error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}<Button label={busy ? t('concern.submitting') : t('concern.submit')} onPress={submit} loading={busy} /></View>}
    >
      {booking.pets.length > 1 ? (
        <>
          <Text variant="overline" color="accent">{t('concern.pet')}</Text>
          <ChipSelect options={booking.pets.map((p) => ({ value: p.id, label: p.name }))} selected={petId ? [petId] : []} onChange={(v) => setPetId(v[0])} />
        </>
      ) : null}
      <Text variant="overline" color="accent">{t('concern.category')}</Text>
      <ChipSelect options={CATEGORIES.map((c) => ({ value: c, label: t(`concern.categories.${c}`) }))} selected={[category]} onChange={(v) => setCategory(v[0] as Category)} />
      <Text variant="overline" color="accent">{t('concern.severity')}</Text>
      {SEVERITIES.map((s) => <OptionCard key={s} title={t(`concern.severities.${s}`)} selected={severity === s} onPress={() => setSeverity(s)} />)}
      <TextField label={t('concern.notes')} hint={t('concern.notesHint')} value={notes} onChangeText={setNotes} multiline />
      <Text variant="overline" color="accent">{t('concern.photos')}</Text>
      <PhotoPicker photos={photos} onChange={setPhotos} />
    </FormScreen>
  );
}
