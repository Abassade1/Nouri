import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { petsRepo } from '@/features/pets/repo';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, space } from '@/theme/tokens';
import type { HistoryEvent } from '@/types/pets';

import { Button, Card, Chip, Icon, Text, TextField, type IconName } from '../../ui';

const ICONS: Record<HistoryEvent['type'], IconName> = {
  visit_report: 'clipboard', medication_given: 'check-circle', vet_visit: 'activity', concern_flag: 'alert-triangle',
  flag_action: 'corner-down-right', booking_completed: 'check', note: 'edit-3',
};

/** What to show for each kind of event. The payload shapes are written by database triggers. */
function describe(e: HistoryEvent, t: TFunction<'pets'>) {
  const p = e.payload ?? {};
  const chips: string[] = [];
  let title = t(`history.types.${e.type}`);
  let detail: string | null = null;
  let tone: 'neutral' | 'accent' | 'danger' = 'neutral';

  switch (e.type) {
    case 'visit_report':
      for (const [k, v] of Object.entries(p.checklist ?? {})) if (v) chips.push(t(`history.checklist.${k}`, { defaultValue: k }));
      if (p.photo_count) chips.push(t('history.photos', { count: p.photo_count }));
      break;
    case 'medication_given':
      title = `${title} · ${e.title ?? ''}`;
      detail = p.dose ?? null;
      break;
    case 'concern_flag':
      tone = p.severity === 'urgent' ? 'danger' : 'neutral';
      chips.push(t(`history.severity.${p.severity ?? 'concern'}`, { defaultValue: '' }));
      if (e.title) chips.push(t(`history.categories.${e.title}`, { defaultValue: e.title }));
      detail = p.notes ?? null;
      break;
    case 'flag_action':
      title = t(`history.flagActions.${p.action ?? e.title ?? 'note'}`, { defaultValue: title });
      detail = p.note ?? null;
      break;
    case 'vet_visit':
    case 'note':
      title = e.title || title;
      detail = p.note ?? null;
      break;
  }
  return { title, detail, chips, tone };
}

export function HistorySection({ petId, events, onChange, readOnly = false }: { petId: string; events: HistoryEvent[]; onChange: () => void; readOnly?: boolean }) {
  const { t } = useTranslation('pets');
  const { language } = useLocale();
  const { profile } = useAuth();
  const [kind, setKind] = useState<'vet_visit' | 'note' | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const reset = () => { setKind(null); setTitle(''); setNote(''); setDate(''); setErrors({}); };

  const save = async () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t('errors.required');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = t('errors.invalidDate');
    setErrors(next);
    if (Object.keys(next).length || !kind || !profile) return;
    await petsRepo.addHistory(profile.id, petId, {
      type: kind, title: title.trim(), note: note.trim() || null,
      occurred_at: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString(),
    });
    reset();
    onChange();
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">{t('history.title')}</Text>
      <Text variant="caption" color="inkMuted">{t('history.intro')}</Text>

      {kind && !readOnly ? (
        <Card>
          <TextField label={t('history.entryTitle')} value={title} onChangeText={setTitle} error={errors.title} />
          <TextField label={t('history.entryNote')} value={note} onChangeText={setNote} multiline />
          <TextField label={t('history.entryDate')} hint={t('history.dateHint')} value={date} onChangeText={setDate} error={errors.date} ltr keyboardType="numbers-and-punctuation" />
          <View style={styles.row}>
            <Button label={t('history.save')} onPress={save} style={{ flex: 1 }} />
            <Button variant="ghost" label={t('meds.cancel')} onPress={reset} />
          </View>
        </Card>
      ) : !readOnly ? (
        <View style={styles.row}>
          <Button variant="secondary" icon="plus" label={t('history.addVet')} onPress={() => setKind('vet_visit')} style={{ flex: 1 }} />
          <Button variant="secondary" icon="edit-3" label={t('history.addNote')} onPress={() => setKind('note')} />
        </View>
      ) : null}

      {events.length === 0 ? <Text color="inkFaint" style={{ marginTop: space.sm }}>{t('history.empty')}</Text> : null}

      <View style={styles.timeline}>
        {events.map((e, i) => {
          const d = describe(e, t);
          return (
            <View key={e.id} style={styles.item}>
              <View style={styles.rail}>
                <View style={[styles.dot, d.tone === 'danger' && { backgroundColor: colors.dangerSoft }]}>
                  <Icon name={ICONS[e.type]} size={14} color={d.tone === 'danger' ? 'danger' : 'accent'} />
                </View>
                {i < events.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.body}>
                <Text variant="bodyStrong" auto>{d.title}</Text>
                <Text variant="caption" color="inkFaint">{formatDateTime(e.occurred_at, language)}</Text>
                {d.detail ? <Text variant="caption" color="inkMuted" auto>{d.detail}</Text> : null}
                {d.chips.length ? (
                  <View style={styles.chips}>
                    {d.chips.map((c) => <Chip key={c} label={c} tone={d.tone === 'danger' ? 'danger' : 'neutral'} />)}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  timeline: { marginTop: space.md },
  item: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 1, backgroundColor: colors.line, marginVertical: 4 },
  body: { flex: 1, gap: 2, paddingBottom: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
});
