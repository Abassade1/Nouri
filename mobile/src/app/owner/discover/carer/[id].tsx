import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { CarerAvatar } from '@/components/features/CarerAvatar';
import { RatingLabel } from '@/components/features/RatingLabel';
import { Button, Card, Chip, Icon, Reveal, Screen, Text } from '@/components/ui';
import { marketplaceRepo } from '@/features/marketplace/repo';
import { publicUrl } from '@/features/media/repo';
import { serviceImage } from '@/features/media/serviceImages';
import type { CarerDetail, CityInfo, ServiceInfo } from '@/features/marketplace/types';
import { formatClock, formatCurrency, formatDate, localized, weekdayName } from '@/lib/format';
import { trimTime } from '@/lib/time';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export default function CarerProfile() {
  const { t } = useTranslation('marketplace');
  const { language } = useLocale();
  const router = useRouter();
  const { id, flag, service } = useLocalSearchParams<{ id: string; flag?: string; service?: string }>();

  const [detail, setDetail] = useState<CarerDetail | null>(null);
  const [city, setCity] = useState<CityInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const d = await marketplaceRepo.getCarer(id);
        setDetail(d);
        if (d) {
          const [cities, svc] = await Promise.all([marketplaceRepo.listCities(), marketplaceRepo.listServices(d.listing.city_id)]);
          setCity(cities.find((c) => c.id === d.listing.city_id) ?? null);
          setServices(svc);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [id]);

  if (!detail) return <Screen><BackLink />{loaded ? <Text color="inkMuted">{t('profile.notFound')}</Text> : null}</Screen>;
  const c = detail.listing;
  const byId = new Map(services.map((s) => [s.id, s]));
  const firstService = byId.get(c.services[0]?.service_id ?? '');
  const ownCover = publicUrl('carer-photos', detail.photos[0]?.path);
  const cover = ownCover ? { uri: ownCover } : firstService ? serviceImage(firstService) : null;

  return (
    <Screen footer={<Button label={t('profile.request')} onPress={() => router.push({ pathname: '/owner/discover/book/[carerId]', params: { carerId: c.user_id, ...(flag ? { flag } : {}), ...(service ? { service } : {}) } })} />}>
      <BackLink />
      <Reveal>
        {cover ? (
          <View style={styles.cover}>
            <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          </View>
        ) : null}
        <View style={[styles.hero, cover ? styles.heroOverlap : null]}>
          <View style={styles.avatarRing}>
            <CarerAvatar name={c.display_name} path={c.avatar_path} size={88} />
          </View>
          <View style={[{ flex: 1, gap: 4 }, cover ? styles.heroText : null]}>
            <Text variant="title" auto>{c.display_name}</Text>
            <RatingLabel avg={c.rating_avg} count={c.rating_count} />
            {c.postal_area ? <Text variant="caption" color="inkFaint">{t('profile.basedIn', { area: c.postal_area })}</Text> : null}
          </View>
        </View>
        {c.headline ? <Text color="inkMuted" auto style={{ marginTop: space.md }}>{c.headline}</Text> : null}
      </Reveal>

      <View style={styles.sections}>
        {detail.badges.length ? (
          <View style={styles.section}>
            <Text variant="heading">{t('profile.verified')}</Text>
            <Text variant="caption" color="inkMuted">{t('profile.verifiedBy')}</Text>
            {detail.badges.map((b, i) => (
              <Card key={i} style={styles.badgeCard}>
                <Icon name="shield" size={18} color="accent" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{t(`badges.${b.type}`)}</Text>
                  <Text variant="caption" color="inkMuted" auto>{b.title}{b.issuer ? ` · ${t('profile.issuedBy', { issuer: b.issuer })}` : ''}</Text>
                  {b.expires_on ? <Text variant="caption" color="inkFaint">{t('profile.expires', { date: formatDate(b.expires_on, language) })}</Text> : null}
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {detail.photos.length ? (
          <View style={styles.section}>
            <Text variant="heading">{t('profile.photos')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {detail.photos.map((p) => {
                const tag = p.service_id ? byId.get(p.service_id) : undefined;
                return (
                  <View key={p.id} style={styles.photo} accessible accessibilityRole="image" accessibilityLabel={p.caption ?? (tag ? localized(tag.name_i18n, language) : undefined)}>
                    <Image source={{ uri: publicUrl('carer-photos', p.path) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    {tag || p.caption ? (
                      <View style={styles.photoScrim}>
                        {tag ? <Text variant="caption" color="onAccent" numberOfLines={1}>{localized(tag.name_i18n, language)}</Text> : null}
                        {p.caption ? <Text variant="caption" color="onAccentMuted" numberOfLines={2} auto>{p.caption}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="heading">{t('profile.about')}</Text>
          <Text auto>{c.bio}</Text>
          {c.years_experience != null ? <Text variant="caption" color="inkMuted">{t('profile.experience')}: {t('profile.years', { years: c.years_experience })}</Text> : null}
          {c.languages_spoken.length ? <Text variant="caption" color="inkMuted">{t('profile.languages')}: {c.languages_spoken.map((l) => t(`languages.${l}`, { defaultValue: l })).join(', ')}</Text> : null}
          <View style={styles.chips}>{c.specialties.map((s) => <Chip key={s} label={t(`specialties.${s}`, { defaultValue: s })} />)}</View>
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t('profile.services')}</Text>
          <Card>
            {c.services.map((s) => {
              const svc = byId.get(s.service_id);
              return (
                <View key={s.service_id} style={styles.rate}>
                  {svc ? <Image source={serviceImage(svc)} style={styles.thumb} contentFit="cover" /> : null}
                  <Text style={{ flex: 1 }}>{svc ? localized(svc.name_i18n, language) : ''}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="bodyStrong">{city ? formatCurrency(s.rate_cents, city.currency, language) : ''}</Text>
                    {svc ? <Text variant="caption" color="inkFaint">{t(`units.${svc.rate_unit}`)}</Text> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t('profile.availability')}</Text>
          {detail.availability.length === 0 ? <Text color="inkFaint">{t('profile.noAvailability')}</Text> : (
            <Card>
              {ORDER.map((d) => {
                const wins = detail.availability.filter((w) => w.weekday === d);
                return (
                  <View key={d} style={styles.rate}>
                    <Text style={{ flex: 1 }}>{weekdayName(d, language)}</Text>
                    <Text variant="caption" color={wins.length ? 'ink' : 'inkFaint'}>
                      {wins.length ? wins.map((w) => `${formatClock(trimTime(w.start_time), language)} – ${formatClock(trimTime(w.end_time), language)}`).join(' · ') : t('profile.closed')}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t('profile.reviews')}</Text>
          {detail.reviews.length === 0 ? <Text color="inkFaint">{t('profile.noReviews')}</Text> : detail.reviews.map((r) => (
            <Card key={r.id}>
              <View style={styles.rate}>
                <Text variant="bodyStrong" auto style={{ flex: 1 }}>{r.reviewer_first_name}</Text>
                <RatingLabel avg={r.rating} count={1} />
              </View>
              {r.comment ? <Text variant="caption" color="inkMuted" auto>{r.comment}</Text> : null}
              <Text variant="caption" color="inkFaint">{formatDate(r.created_at, language)}</Text>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.sunken, marginTop: space.md, ...shadow.card },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroOverlap: { marginTop: -44, paddingHorizontal: space.md, alignItems: 'flex-start' },
  heroText: { paddingTop: 52 },
  avatarRing: { borderRadius: radius.pill, borderWidth: 4, borderColor: colors.paper, backgroundColor: colors.paper },
  gallery: { gap: space.md, paddingEnd: space.lg },
  photo: { width: 200, height: 250, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.sunken },
  photoScrim: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: space.md, backgroundColor: colors.overlay, gap: 2 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  sections: { gap: space.xxl, marginTop: space.xxl },
  section: { gap: space.sm },
  badgeCard: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  rate: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
