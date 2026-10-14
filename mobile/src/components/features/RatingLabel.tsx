import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatNumber } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

import { Icon, Text } from '../ui';

/** ★ 4.9 (27), or "New" for a carer without reviews yet. */
export function RatingLabel({ avg, count }: { avg: number; count: number }) {
  const { t } = useTranslation('marketplace');
  const { language } = useLocale();
  if (!count) return <Text variant="caption" color="accent">{t('discover.new')}</Text>;
  return (
    <View style={styles.row} accessible accessibilityLabel={t('profile.rating', { rating: formatNumber(avg, language, { maximumFractionDigits: 1 }) })}>
      <Icon name="star" size={13} color="accent" />
      <Text variant="caption" color="ink">{formatNumber(avg, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text>
      <Text variant="caption" color="inkFaint">({formatNumber(count, language)})</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: space.xs } });
