import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { PhotoPicker } from '@/components/features/PhotoPicker';
import { ScorePicker } from '@/components/features/ScorePicker';
import { Button, Card, Checkbox, EmptyState, Text, TextField } from '@/components/ui';
import { useBooking } from '@/features/bookings/hooks';
import { petsRepo, type PickedImage } from '@/features/pets/repo';
import { visitsRepo, type ScoreInput } from '@/features/visits/repo';
import { space } from '@/theme/tokens';
import type { Medication, WellbeingMetric } from '@/types/pets';

const METRICS: WellbeingMetric[] = ['health', 'nutrition_hydration', 'activity', 'happiness'];
const CHECKLIST = ['fed', 'walked', 'meds_given', 'water_refreshed'] as const;

export default function VisitReportScreen() {
  const { t } = useTranslation('visits');
  const { t: tp } = useTranslation('pets');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { booking } = useBooking(id);

  const [summary, setSummary] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({}); // `${petId}:${metric}`
  const [meds, setMeds] = useState<(Medication & { pet_id: string })[]>([]);
  const [medsGiven, setMedsGiven] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!booking) return;
    void Promise.all(booking.pets.map((p) => petsRepo.getPet(p.id))).then((all) =>
      setMeds(all.flatMap((d) => (d ? d.medications.filter((m) => m.is_active).map((m) => ({ ...m, pet_id: d.pet.id })) : []))),
    ).catch(() => setMeds([]));
  }, [booking]);

  if (!booking) return <FormScreen title={t('report.title')}><View /></FormScreen>;

  const canComplete = Date.now() >= new Date(booking.start_at).getTime() && ['confirmed', 'in_progress'].includes(booking.status);

  const submit = async () => {
    setError(null);
    const all: ScoreInput[] = [];
    for (const pet of booking.pets) for (const metric of METRICS) {
      const score = scores[`${pet.id}:${metric}`];
      if (!score) return setError(t('report.needScores'));
      all.push({ pet_id: pet.id, metric, score });
    }
    setBusy(true);
    try {
      await visitsRepo.submitReport({
        bookingId: booking.id, summary, checklist: { ...checks, meds_given: checks.meds_given || medsGiven.length > 0 },
        medicationIds: medsGiven, photos, scores: all, completeAfter: complete && canComplete,
      });
      setSent(true);
    } catch {
      setError(t('report.error'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <FormScreen title="" footer={<Button label={t('report.back')} onPress={() => router.back()} />}>
        <EmptyState icon="check-circle" title={t('report.sentTitle')} body={t('report.sentBody')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('report.title')}
      intro={t('report.intro')}
      footer={<View style={{ gap: space.sm }}>{error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}<Button label={busy ? t('report.submitting') : t('report.submit')} onPress={submit} loading={busy} /></View>}
    >
      <TextField label={t('report.summary')} hint={t('report.summaryHint')} value={summary} onChangeText={setSummary} multiline />

      {CHECKLIST.filter((k) => k !== 'meds_given').map((k) => (
        <Checkbox key={k} checked={!!checks[k]} onToggle={() => setChecks((c) => ({ ...c, [k]: !c[k] }))} label={t(`report.checklist.${k}`)} />
      ))}

      {meds.length > 0 ? (
        <Card>
          <Text variant="bodyStrong">{t('report.meds')}</Text>
          {meds.map((m) => (
            <Checkbox
              key={m.id}
              checked={medsGiven.includes(m.id)}
              onToggle={() => setMedsGiven((g) => (g.includes(m.id) ? g.filter((x) => x !== m.id) : [...g, m.id]))}
              label={`${m.name}${m.dose ? ` · ${m.dose}` : ''}${m.times.length ? ` · ${m.times.join(', ')}` : ''}`}
            />
          ))}
        </Card>
      ) : null}

      <Text variant="overline" color="accent">{t('report.scores')}</Text>
      <Text variant="caption" color="inkMuted">{t('report.scoresIntro')}</Text>
      {booking.pets.map((pet) => (
        <Card key={pet.id}>
          <Text variant="heading" auto>{pet.name}</Text>
          {METRICS.map((metric) => (
            <View key={metric} style={{ gap: space.xs }}>
              <Text variant="caption" color="inkMuted">{tp(`wellbeing.metrics.${metric}`)}</Text>
              <ScorePicker label={`${pet.name} ${tp(`wellbeing.metrics.${metric}`)}`} value={scores[`${pet.id}:${metric}`] ?? null} onChange={(n) => setScores((s) => ({ ...s, [`${pet.id}:${metric}`]: n }))} />
            </View>
          ))}
        </Card>
      ))}

      <Text variant="overline" color="accent">{t('report.photos')}</Text>
      <PhotoPicker photos={photos} onChange={setPhotos} />

      {canComplete ? <Checkbox checked={complete} onToggle={() => setComplete((c) => !c)} label={t('report.alsoComplete')} /> : null}
    </FormScreen>
  );
}
