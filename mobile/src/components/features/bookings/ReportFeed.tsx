import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { visitsRepo, type ReportItem } from '@/features/visits/repo';
import { formatDateTime } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, space } from '@/theme/tokens';

import { Card, Chip, Text } from '../../ui';

/** The visit-report feed for one booking: notes, checklist, photos and the wellbeing scores that were given. */
export function ReportFeed({ bookingId, petNames, version }: { bookingId: string; petNames: Record<string, string>; version?: number }) {
  const { t } = useTranslation('visits');
  const { t: tp } = useTranslation('pets');
  const { language } = useLocale();
  const [reports, setReports] = useState<ReportItem[]>([]);

  // Reload every time the screen comes back into view (e.g. after sending a report).
  useFocusEffect(
    useCallback(() => {
      void visitsRepo.listReports(bookingId).then(setReports).catch(() => setReports([]));
    }, [bookingId, version]),
  );

  if (reports.length === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">{t('feed.title')}</Text>
      {reports.map((r) => (
        <Card key={r.id}>
          <Text variant="caption" color="inkFaint">{formatDateTime(r.created_at, language)}</Text>
          {r.summary ? <Text auto>{r.summary}</Text> : null}
          <View style={styles.chips}>
            {Object.entries(r.checklist).filter(([, v]) => v).map(([k]) => <Chip key={k} tone="accent" label={t(`report.checklist.${k as 'fed'}`, { defaultValue: k })} />)}
          </View>
          {r.photo_urls.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {r.photo_urls.map((u) => <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" />)}
            </ScrollView>
          ) : null}
          {r.scores.length ? (
            <View style={{ gap: 4, marginTop: space.xs }}>
              <Text variant="overline" color="inkFaint">{t('feed.scores')}</Text>
              {[...new Set(r.scores.map((s) => s.pet_id))].map((petId) => (
                <View key={petId} style={styles.scoreRow}>
                  <Text variant="caption" color="inkMuted" auto style={{ minWidth: 70 }}>{petNames[petId] ?? ''}</Text>
                  <View style={styles.chips}>
                    {r.scores.filter((s) => s.pet_id === petId).map((s) => <Chip key={s.metric} label={`${tp(`wellbeing.metrics.${s.metric}`)} ${s.score}/5`} />)}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, flex: 1 },
  photo: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.sunken },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
