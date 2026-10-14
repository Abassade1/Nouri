import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { StarRating } from '@/components/features/StarRating';
import { Card, EmptyState, Reveal, Screen, Text } from '@/components/ui';
import { visitsRepo, type ReviewItem } from '@/features/visits/repo';
import { formatDate, formatNumber } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

export default function CarerReviews() {
  const { t } = useTranslation('visits');
  const { language } = useLocale();
  const { profile } = useAuth();
  const [items, setItems] = useState<ReviewItem[] | null>(null);

  useEffect(() => { if (profile) void visitsRepo.listReviewsForCarer(profile.id).then(setItems).catch(() => setItems([])); }, [profile]);

  const avg = items && items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <Text variant="title">{t('carerReviews.title')}</Text>
        {items && items.length > 0 ? (
          <View style={styles.avg}>
            <Text variant="display">{formatNumber(avg, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text>
            <View style={{ gap: 4 }}><StarRating value={Math.round(avg)} size={18} label={t('carerReviews.average')} /><Text variant="caption" color="inkMuted">{t('carerReviews.average')}</Text></View>
          </View>
        ) : null}
      </Reveal>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        {items && items.length === 0 ? <EmptyState icon="star" title={t('carerReviews.title')} body={t('carerReviews.empty')} /> : null}
        {items?.map((r) => (
          <Card key={r.id}>
            <StarRating value={r.rating} size={16} label={`${r.rating}`} />
            {r.comment ? <Text auto>{r.comment}</Text> : null}
            <Text variant="caption" color="inkFaint">{formatDate(r.created_at, language)}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ avg: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg } });
