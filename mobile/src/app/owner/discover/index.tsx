import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CarerAvatar } from '@/components/features/CarerAvatar';
import { DateStrip } from '@/components/features/DateStrip';
import { RatingLabel } from '@/components/features/RatingLabel';
import { Button, Chip, ChipSelect, EmptyState, Icon, Reveal, Screen, ScreenTitle, Text } from '@/components/ui';
import { marketplaceRepo } from '@/features/marketplace/repo';
import type { AvailabilityWindow, CarerListing, CityInfo, ServiceInfo } from '@/features/marketplace/types';
import { formatCurrency, localized } from '@/lib/format';
import { generateSlots, upcomingDates, weekdayOf } from '@/lib/time';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, space } from '@/theme/tokens';

const SPECIALTIES = ['senior_care', 'medication', 'anxious_pets', 'puppies', 'large_breeds', 'special_needs'] as const;
const RATINGS = [0, 4, 4.5];

export default function Discover() {
  const { t } = useTranslation('marketplace');
  const { language } = useLocale();
  const router = useRouter();
  const { service: serviceSlug, flag } = useLocalSearchParams<{ service?: string; flag?: string }>();

  const [cities, setCities] = useState<CityInfo[]>([]);
  const [city, setCity] = useState<CityInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [carers, setCarers] = useState<CarerListing[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityWindow[]>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [more, setMore] = useState(false);

  useEffect(() => {
    void marketplaceRepo.listCities().then((list) => {
      setCities(list);
      setCity(list[0] ?? null);
      if (!list.length) setState('ready');
    }).catch(() => setState('error'));
  }, []);

  useEffect(() => {
    if (!city) return;
    setState('loading');
    Promise.all([marketplaceRepo.listServices(city.id), marketplaceRepo.searchCarers(city.id)])
      .then(([s, res]) => {
        setServices(s); setCarers(res.carers); setAvailability(res.availability); setState('ready');
        if (serviceSlug) setServiceId(s.find((x) => x.slug === serviceSlug)?.id ?? null);
      })
      .catch(() => setState('error'));
  }, [city]);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const dates = useMemo(() => (city ? upcomingDates(city.timezone, 21) : []), [city]);

  const results = useMemo(() => {
    if (!city) return [];
    const unit = serviceId ? serviceById.get(serviceId)?.rate_unit ?? 'per_visit' : 'per_visit';
    return carers.filter((c) => {
      if (serviceId && !c.services.some((s) => s.service_id === serviceId)) return false;
      if (minRating && c.rating_avg < minRating) return false;
      if (specialties.length && !specialties.some((s) => c.specialties.includes(s))) return false;
      if (date) {
        const windows = (availability[c.user_id] ?? []).filter((w) => w.weekday === weekdayOf(date));
        if (generateSlots(windows, { date, tz: city.timezone, unit }).length === 0) return false;
      }
      return true;
    });
  }, [carers, availability, city, serviceId, date, minRating, specialties, serviceById]);

  const clear = () => { setServiceId(null); setDate(null); setMinRating(0); setSpecialties([]); };
  const filtersActive = !!(serviceId || date || minRating || specialties.length);

  const priceFor = (c: CarerListing) => {
    const rates = serviceId ? c.services.filter((s) => s.service_id === serviceId) : c.services;
    if (!rates.length || !city) return null;
    return formatCurrency(Math.min(...rates.map((r) => r.rate_cents)), city.currency, language);
  };

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('discover.title')} subtitle={city ? t('discover.subtitle', { city: localized(city.name_i18n, language) }) : undefined} />

      {cities.length > 1 ? (
        <View style={{ marginBottom: space.lg }}>
          <ChipSelect options={cities.map((c) => ({ value: c.id, label: localized(c.name_i18n, language) }))} selected={city ? [city.id] : []} onChange={(v) => setCity(cities.find((c) => c.id === v[0]) ?? null)} />
        </View>
      ) : null}

      {city ? (
        <View style={styles.filters}>
          <Text variant="overline" color="inkMuted">{t('discover.service')}</Text>
          <ChipSelect
            scroll
            options={[{ value: '', label: t('discover.all') }, ...services.map((s) => ({ value: s.id, label: localized(s.name_i18n, language) }))]}
            selected={[serviceId ?? '']}
            onChange={(v) => setServiceId(v[0] || null)}
          />
          <Text variant="overline" color="inkMuted" style={{ marginTop: space.sm }}>{t('discover.availableOn')}</Text>
          <DateStrip dates={dates} selected={date} onSelect={setDate} anyLabel={t('discover.anyDay')} />

          <Pressable onPress={() => setMore((m) => !m)} style={styles.moreToggle} accessibilityRole="button">
            <Text variant="caption" color="accent">{more ? t('discover.fewerFilters') : t('discover.moreFilters')}</Text>
            <Icon name={more ? 'chevron-up' : 'chevron-down'} size={14} color="accent" />
          </Pressable>
          {more ? (
            <View style={{ gap: space.sm }}>
              <Text variant="overline" color="inkMuted">{t('discover.minRating')}</Text>
              <ChipSelect options={RATINGS.map((r) => ({ value: String(r), label: r === 0 ? t('discover.ratingAny') : `${r}+ ★` }))} selected={[String(minRating)]} onChange={(v) => setMinRating(Number(v[0]))} />
              <Text variant="overline" color="inkMuted">{t('discover.specialty')}</Text>
              <ChipSelect multiple options={SPECIALTIES.map((s) => ({ value: s, label: t(`specialties.${s}`) }))} selected={specialties} onChange={setSpecialties} />
            </View>
          ) : null}
        </View>
      ) : null}

      {state === 'error' ? <EmptyState icon="wifi-off" title={t('discover.loadError')} body="" /> : null}
      {state === 'ready' && !city ? <EmptyState icon="map-pin" title={t('discover.noCities')} body="" /> : null}
      {state === 'ready' && city && results.length === 0 ? (
        <>
          <EmptyState icon="search" title={t('discover.emptyTitle')} body={t('discover.emptyBody')} />
          {filtersActive ? <Button variant="secondary" label={t('discover.clear')} onPress={clear} /> : null}
        </>
      ) : null}

      <View style={styles.list}>
        {results.map((c, i) => (
          <Reveal key={c.user_id} delay={Math.min(i, 6) * 50}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/owner/discover/carer/[id]', params: { id: c.user_id, ...(flag ? { flag } : {}), ...(serviceSlug ? { service: serviceSlug } : {}) } })}
              style={styles.card}
            >
              <View style={styles.cardHead}>
                <CarerAvatar name={c.display_name} path={c.avatar_path} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="heading" auto>{c.display_name}</Text>
                  {c.headline ? <Text variant="caption" color="inkMuted" auto numberOfLines={2}>{c.headline}</Text> : null}
                </View>
              </View>
              <View style={styles.meta}>
                <RatingLabel avg={c.rating_avg} count={c.rating_count} />
                {priceFor(c) ? <Text variant="caption" color="inkMuted">{t('discover.from', { price: priceFor(c) })}</Text> : null}
              </View>
              <View style={styles.badges}>
                {c.verified_badges.slice(0, 3).map((b) => <Chip key={b} tone="accent" label={t(`badges.${b}`)} />)}
              </View>
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm, marginBottom: space.xl },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingVertical: space.sm },
  list: { gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
