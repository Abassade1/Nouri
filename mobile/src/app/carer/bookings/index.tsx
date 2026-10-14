import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BookingRow } from '@/components/features/bookings/BookingRow';
import { EmptyState, Screen, ScreenTitle, Text } from '@/components/ui';
import { useBookings } from '@/features/bookings/hooks';
import { isOpen, type BookingItem } from '@/features/bookings/types';
import { formatDate } from '@/lib/format';
import { todayInZone } from '@/lib/time';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

/** Day key in the booking's own city time zone, for grouping the agenda. */
const dayKey = (b: BookingItem) => todayInZone(b.timezone, new Date(b.start_at));

export default function CarerBookings() {
  const { t } = useTranslation('bookings');
  const { language } = useLocale();
  const router = useRouter();
  const { items } = useBookings('carer');

  const open = (id: string) => router.push({ pathname: '/carer/bookings/[id]', params: { id } });
  const all = items ?? [];
  const requests = all.filter((b) => b.status === 'requested').sort((a, b) => a.start_at.localeCompare(b.start_at));
  const agenda = all.filter((b) => ['accepted', 'confirmed', 'in_progress'].includes(b.status)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = all.filter((b) => !isOpen(b.status)).sort((a, b) => b.start_at.localeCompare(a.start_at));

  const days = [...new Set(agenda.map(dayKey))];

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('list.title')} />
      {items && items.length === 0 ? <EmptyState icon="calendar" title={t('list.emptyTitle')} body={t('list.carerEmptyBody')} /> : null}

      {items && items.length > 0 ? (
        <View style={styles.group}>
          <Text variant="overline" color="accent">{t('list.requests')}</Text>
          {requests.length === 0 ? <Text color="inkFaint">{t('list.noRequests')}</Text> : requests.map((b) => <BookingRow key={b.id} booking={b} role="carer" onPress={() => open(b.id)} />)}
        </View>
      ) : null}

      {days.length ? (
        <View style={styles.group}>
          <Text variant="overline" color="inkMuted">{t('list.agenda')}</Text>
          {days.map((d) => (
            <View key={d} style={{ gap: space.sm }}>
              <Text variant="bodyStrong">{formatDate(`${d}T12:00:00Z`, language, 'UTC')}</Text>
              {agenda.filter((b) => dayKey(b) === d).map((b) => <BookingRow key={b.id} booking={b} role="carer" onPress={() => open(b.id)} />)}
            </View>
          ))}
        </View>
      ) : null}

      {past.length ? (
        <View style={styles.group}>
          <Text variant="overline" color="inkMuted">{t('list.past')}</Text>
          {past.map((b) => <BookingRow key={b.id} booking={b} role="carer" onPress={() => open(b.id)} />)}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ group: { gap: space.md, marginBottom: space.xl } });
