import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Card, Text, TextField } from '@/components/ui';
import { bookingsRepo } from '@/features/bookings/repo';
import type { AvailabilityWindow } from '@/features/marketplace/types';
import { normalizeTime } from '@/features/pets/age';
import { formatClock, weekdayName } from '@/lib/format';
import { timeToMinutes, trimTime } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export default function AvailabilityEditor() {
  const { t } = useTranslation('bookings');
  const { language } = useLocale();
  const { profile } = useAuth();
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (profile) setWindows(await bookingsRepo.listAvailability(profile.id));
  }, [profile]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => { setAdding(null); setFrom(''); setTo(''); setError(null); };

  const save = async () => {
    if (adding === null || !profile) return;
    const a = normalizeTime(from);
    const b = normalizeTime(to);
    if (!a || !b) return setError(t('availability.errors.invalidTime'));
    if (timeToMinutes(b) <= timeToMinutes(a)) return setError(t('availability.errors.order'));
    const clash = windows.some((w) => w.weekday === adding && timeToMinutes(a) < timeToMinutes(trimTime(w.end_time)) && timeToMinutes(b) > timeToMinutes(trimTime(w.start_time)));
    if (clash) return setError(t('availability.errors.overlap'));
    try {
      await bookingsRepo.addWindow(profile.id, adding, a, b);
      reset();
      await load();
    } catch {
      setError(t('availability.errors.generic'));
    }
  };

  return (
    <FormScreen title={t('availability.title')} intro={t('availability.intro')}>
      {ORDER.map((d) => {
        const wins = windows.filter((w) => w.weekday === d).sort((x, y) => x.start_time.localeCompare(y.start_time));
        return (
          <Card key={d}>
            <View style={styles.head}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>{weekdayName(d, language)}</Text>
              {wins.length === 0 ? <Text variant="caption" color="inkFaint">{t('availability.closed')}</Text> : null}
              <Button variant="ghost" icon="plus" label={t('availability.add')} onPress={() => { setAdding(d); setError(null); }} />
            </View>
            {wins.map((w) => (
              <View key={w.id} style={styles.head}>
                <Text style={{ flex: 1 }}>{formatClock(trimTime(w.start_time), language)} – {formatClock(trimTime(w.end_time), language)}</Text>
                <Button variant="ghost" label={t('availability.remove')} onPress={async () => { await bookingsRepo.removeWindow(w.id); await load(); }} />
              </View>
            ))}
            {adding === d ? (
              <View style={{ gap: space.md, marginTop: space.sm }}>
                <View style={styles.pair}>
                  <View style={{ flex: 1 }}><TextField label={t('availability.from')} hint={t('availability.hint')} value={from} onChangeText={setFrom} ltr placeholder="09:00" keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><TextField label={t('availability.to')} value={to} onChangeText={setTo} ltr placeholder="17:00" keyboardType="numbers-and-punctuation" /></View>
                </View>
                {error ? <Text variant="caption" color="danger">{error}</Text> : null}
                <View style={styles.head}>
                  <Button label={t('availability.save')} onPress={save} style={{ flex: 1 }} />
                  <Button variant="ghost" label={t('availability.cancel')} onPress={reset} />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
});
