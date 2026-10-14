import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BookingRow } from '@/components/features/bookings/BookingRow';
import { EmptyState, Screen, ScreenTitle, Text } from '@/components/ui';
import { useBookings } from '@/features/bookings/hooks';
import { isOpen } from '@/features/bookings/types';
import { space } from '@/theme/tokens';

export default function OwnerBookings() {
  const { t } = useTranslation('bookings');
  const router = useRouter();
  const { items } = useBookings('owner');
  const upcoming = (items ?? []).filter((b) => isOpen(b.status)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = (items ?? []).filter((b) => !isOpen(b.status)).sort((a, b) => b.start_at.localeCompare(a.start_at));
  const open = (id: string) => router.push({ pathname: '/owner/bookings/[id]', params: { id } });

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('list.title')} />
      {items && items.length === 0 ? <EmptyState icon="calendar" title={t('list.emptyTitle')} body={t('list.emptyBody')} /> : null}
      {upcoming.length ? (
        <View style={styles.group}>
          <Text variant="overline" color="inkMuted">{t('list.upcoming')}</Text>
          {upcoming.map((b) => <BookingRow key={b.id} booking={b} role="owner" onPress={() => open(b.id)} />)}
        </View>
      ) : null}
      {past.length ? (
        <View style={styles.group}>
          <Text variant="overline" color="inkMuted">{t('list.past')}</Text>
          {past.map((b) => <BookingRow key={b.id} booking={b} role="owner" onPress={() => open(b.id)} />)}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ group: { gap: space.md, marginBottom: space.xl } });
