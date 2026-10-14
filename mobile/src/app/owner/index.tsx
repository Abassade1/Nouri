import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Icon, Reveal, Screen, ScreenTitle, Text } from '@/components/ui';
import { visitsRepo, type FlagItem } from '@/features/visits/repo';
import { useCities } from '@/features/useCities';
import { localized } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

export default function OwnerHome() {
  const { t } = useTranslation('owner');
  const { t: tc } = useTranslation('common');
  const { language } = useLocale();
  const { profile, isPreview } = useAuth();
  const { cities } = useCities();
  const { t: tv } = useTranslation('visits');
  const router = useRouter();
  const [flags, setFlags] = useState<FlagItem[]>([]);
  useFocusEffect(useCallback(() => { if (profile) void visitsRepo.listOpenFlags(profile.id).then(setFlags).catch(() => setFlags([])); }, [profile]));

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <Screen edges={['top']}>
      <ScreenTitle
        overline={isPreview ? tc('preview.banner') : undefined}
        title={firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        subtitle={t('home.subtitle')}
      />

      {flags.length > 0 ? (
        <Reveal>
          <View style={styles.flags}>
            <Text variant="overline" color="danger">{tv('flag.homeTitle')}</Text>
            {flags.map((f) => (
              <Card key={f.id} style={styles.flagCard}>
                <View style={styles.cityHead}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong" auto>{tv('flag.homeItem', { pet: f.pet_name })}</Text>
                    <Text variant="caption" color="inkMuted" auto numberOfLines={2}>{f.notes}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color="danger" directional />
                </View>
                <Button variant="secondary" label={tv('flag.next')} onPress={() => router.push({ pathname: '/owner/concern/[id]', params: { id: f.id } })} />
              </Card>
            ))}
          </View>
        </Reveal>
      ) : null}

      <Text variant="overline" color="inkMuted" style={styles.sectionLabel}>
        {t('home.citiesTitle')}
      </Text>

      <View style={styles.list}>
        {cities.map((city, index) => (
          <Reveal key={city.id} delay={120 + index * 70}>
            <Card>
              <View style={styles.cityHead}>
                <Text variant="heading">{localized(city.name_i18n, language)}</Text>
                <Chip tone={city.is_active ? 'accent' : 'neutral'} label={city.is_active ? tc('live') : tc('notYetLive')} />
              </View>
              {city.is_active && city.launch_areas.length > 0 ? (
                <View style={styles.areas}>
                  <Text variant="caption" color="inkMuted">
                    {t('home.launchAreas')}
                  </Text>
                  {/* Place names are proper nouns (Latin script); separate chips keep them intact inside Arabic text. */}
                  <View style={styles.chips}>
                    {city.launch_areas.slice(0, 5).map((area) => (
                      <Chip key={area} label={area} />
                    ))}
                  </View>
                </View>
              ) : null}
              {!city.is_active ? (
                <>
                  <Text variant="caption" color="inkFaint">
                    {t('home.waitlistHint')}
                  </Text>
                  <Button variant="secondary" label={tv('waitlist.join')} onPress={() => router.push({ pathname: '/waitlist', params: { cityId: city.id } })} />
                </>
              ) : null}
            </Card>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: space.md },
  flags: { gap: space.sm, marginBottom: space.xl },
  flagCard: { borderColor: '#9B3A2E' },
  list: { gap: space.md },
  areas: { gap: space.sm, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
