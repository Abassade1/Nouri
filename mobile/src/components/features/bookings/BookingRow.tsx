import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BookingItem, BookingStatus, Role } from '@/features/bookings/types';
import { formatCurrency, formatDateTime, localized } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

import { Chip, Icon, Text } from '../../ui';

export const statusTone = (s: BookingStatus): 'neutral' | 'accent' | 'danger' =>
  s === 'confirmed' || s === 'in_progress' || s === 'completed' || s === 'accepted' ? 'accent'
    : s === 'declined' || s === 'cancelled' || s === 'payment_failed' || s === 'disputed' ? 'danger' : 'neutral';

export function BookingRow({ booking, role, onPress }: { booking: BookingItem; role: Role; onPress: () => void }) {
  const { t } = useTranslation('bookings');
  const { language } = useLocale();
  const other = role === 'owner' ? booking.carer_name : booking.owner_name;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{localized(booking.service.name_i18n, language)}</Text>
        <Text variant="caption" color="inkMuted" auto>{other}</Text>
        <Text variant="caption" color="inkFaint">{formatDateTime(booking.start_at, language, booking.timezone)}</Text>
        <View style={styles.chips}>
          <Chip tone={statusTone(booking.status)} label={t(`status.${booking.status}`)} />
          {role === 'carer' && booking.is_priority ? <Chip tone="accent" label={t('priority')} /> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.sm }}>
        <Text variant="bodyStrong">
          {formatCurrency(role === 'owner' ? booking.total_cents : booking.carer_payout_cents, booking.currency, language)}
        </Text>
        <Icon name="chevron-right" size={18} color="inkFaint" directional />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  row: { flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card },
});
