import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Sparkline, Text } from '../../ui';
import { space } from '@/theme/tokens';
import type { WellbeingMetric, WellbeingPoint } from '@/types/pets';

const METRICS: WellbeingMetric[] = ['health', 'nutrition_hydration', 'activity', 'happiness'];

/** One small trend chart per metric, newest score highlighted, with the change since last visit. */
export function WellbeingSection({ points }: { points: WellbeingPoint[] }) {
  const { t } = useTranslation('pets');
  const has = points.length > 0;

  return (
    <View style={styles.wrap}>
      <Text variant="heading">{t('wellbeing.title')}</Text>
      <Text variant="caption" color="inkMuted">{t('wellbeing.intro')}</Text>
      {!has ? <Text color="inkFaint">{t('wellbeing.empty')}</Text> : null}
      {has ? (
        <View style={styles.grid}>
          {METRICS.map((metric) => {
            const series = points.filter((p) => p.metric === metric).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map((p) => p.score);
            if (series.length === 0) return null;
            const latest = series[series.length - 1];
            const prev = series.length > 1 ? series[series.length - 2] : latest;
            const trend = latest > prev ? 'up' : latest < prev ? 'down' : 'same';
            const name = t(`wellbeing.metrics.${metric}`);
            return (
              <Card key={metric} style={styles.card}>
                <View style={styles.head}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{name}</Text>
                  <Text variant="title">{latest}</Text>
                  <Text variant="caption" color="inkFaint"> / 5</Text>
                </View>
                <Sparkline values={series} label={t('wellbeing.chartLabel', { metric: name })} />
                <View style={styles.trend}>
                  <Icon name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus'} size={14} color={trend === 'down' ? 'danger' : 'accent'} />
                  <Text variant="caption" color="inkMuted">
                    {trend === 'up' ? t('wellbeing.trendUp') : trend === 'down' ? t('wellbeing.trendDown') : t('wellbeing.trendSame')}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  grid: { gap: space.md, marginTop: space.sm },
  card: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
