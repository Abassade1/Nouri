import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { normalizeTime } from '@/features/pets/age';
import { petsRepo } from '@/features/pets/repo';
import { space } from '@/theme/tokens';
import type { MedFrequency, Medication } from '@/types/pets';

import { Button, Card, Chip, ChipSelect, Text, TextField } from '../../ui';

const FREQ: MedFrequency[] = ['daily', 'twice_daily', 'weekly', 'as_needed'];

export function MedicationsSection({ petId, medications, onChange, readOnly = false }: { petId: string; medications: Medication[]; onChange: () => void; readOnly?: boolean }) {
  const { t } = useTranslation('pets');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState<MedFrequency>('daily');
  const [times, setTimes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const reset = () => { setAdding(false); setName(''); setDose(''); setFreq('daily'); setTimes(''); setInstructions(''); setErrors({}); };

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errors.required');
    const parsed = times.split(',').map((x) => x.trim()).filter(Boolean).map(normalizeTime);
    if (parsed.some((x) => x === null)) next.times = t('errors.invalidTime');
    setErrors(next);
    if (Object.keys(next).length) return;
    await petsRepo.addMedication(petId, {
      name: name.trim(), dose: dose.trim() || null, frequency: freq, times: parsed as string[],
      instructions: instructions.trim() || null, is_active: true,
    });
    reset();
    onChange();
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">{t('meds.title')}</Text>
      {medications.length === 0 && !adding ? <Text color="inkFaint">{t('meds.empty')}</Text> : null}
      {medications.map((m) => (
        <Card key={m.id}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" auto>{m.name}{m.dose ? ` · ${m.dose}` : ''}</Text>
              <Text variant="caption" color="inkMuted">
                {t(`meds.freq.${m.frequency}`)}{m.times.length ? ` · ${m.times.join(', ')}` : ''}
              </Text>
            </View>
            <Chip tone={m.is_active ? 'accent' : 'neutral'} label={m.is_active ? t('meds.active') : t('meds.paused')} />
          </View>
          {m.instructions ? <Text variant="caption" color="inkMuted" auto>{m.instructions}</Text> : null}
          {!readOnly ? <View style={styles.row}>
            <Button variant="ghost" label={m.is_active ? t('meds.pause') : t('meds.resume')} onPress={async () => { await petsRepo.setMedicationActive(m.id, !m.is_active); onChange(); }} />
            <Button variant="ghost" label={t('meds.remove')} onPress={async () => { await petsRepo.removeMedication(m.id); onChange(); }} />
          </View> : null}
        </Card>
      ))}
      {adding && !readOnly ? (
        <Card>
          <TextField label={t('meds.name')} value={name} onChangeText={setName} error={errors.name} />
          <TextField label={t('meds.dose')} value={dose} onChangeText={setDose} />
          <Text variant="caption" color="inkMuted">{t('meds.frequency')}</Text>
          <ChipSelect options={FREQ.map((f) => ({ value: f, label: t(`meds.freq.${f}`) }))} selected={[freq]} onChange={(v) => setFreq(v[0] as MedFrequency)} />
          <TextField label={t('meds.times')} hint={t('meds.timesHint')} value={times} onChangeText={setTimes} error={errors.times} ltr />
          <TextField label={t('meds.instructions')} value={instructions} onChangeText={setInstructions} multiline />
          <View style={styles.row}>
            <Button label={t('meds.save')} onPress={save} style={{ flex: 1 }} />
            <Button variant="ghost" label={t('meds.cancel')} onPress={reset} />
          </View>
        </Card>
      ) : !readOnly ? (
        <Button variant="secondary" icon="plus" label={t('meds.add')} onPress={() => setAdding(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
