import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarerAvatar } from '@/components/features/CarerAvatar';
import { RatingLabel } from '@/components/features/RatingLabel';
import { SpeciesPicker } from '@/components/features/SpeciesPicker';
import { BookingRow, statusTone } from '@/components/features/bookings/BookingRow';
import { PetAvatar } from '@/components/features/pets/PetAvatar';
import { Button, Card, Chip, EmptyState, HeroBadge, HeroHeader, Icon, Reveal, Text } from '@/components/ui';
import { useBookings } from '@/features/bookings/hooks';
import { isOpen } from '@/features/bookings/types';
import { marketplaceRepo } from '@/features/marketplace/repo';
import type { CarerListing, CityInfo, ServiceInfo } from '@/features/marketplace/types';
import { carerCover, photos } from '@/features/media/serviceImages';
import { usePets } from '@/features/pets/hooks';
import { usePlus } from '@/features/plus/usePlus';
import { useCities } from '@/features/useCities';
import { visitsRepo, type FlagItem } from '@/features/visits/repo';
import { formatCurrency, formatDateTime, localized } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, layout, radius, shadow, space } from '@/theme/tokens';

/**
 * The owner's home: a quick way to book, every kind of animal, their pets, what's next,
 * carers available now and what happened recently. Built only from the owner's own data.
 */
export default function OwnerHome() {
  const { t } = useTranslation('owner');
  const { t: tc } = useTranslation('common');
  const { t: tv } = useTranslation('visits');
  const { t: tb } = useTranslation('bookings');
  const { t: tm } = useTranslation('marketplace');
  const { t: tp } = useTranslation('pets');
  const { language } = useLocale();
  const { profile, isPreview } = useAuth();
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  // Once the photo header scrolls away, put a solid strip behind the status bar and darken its text.
  const [scrolled, setScrolled] = useState(false);

  const pets = usePets();
  const { status: plus } = usePlus();
  const { items: bookings } = useBookings('owner');
  const { cities } = useCities();
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [city, setCity] = useState<CityInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [carers, setCarers] = useState<CarerListing[] | null>(null);

  useFocusEffect(useCallback(() => {
    if (profile) void visitsRepo.listOpenFlags(profile.id).then(setFlags).catch(() => setFlags([]));
  }, [profile]));

  // Top-rated carers in the first live city.
  useEffect(() => {
    marketplaceRepo.listCities()
      .then(async (list) => {
        const c = list[0] ?? null;
        setCity(c);
        if (!c) return setCarers([]);
        const [svc, res] = await Promise.all([marketplaceRepo.listServices(c.id), marketplaceRepo.searchCarers(c.id)]);
        setServices(svc);
        setCarers(res.carers.slice(0, 6));
      })
      .catch(() => setCarers([]));
  }, []);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const next = (bookings ?? []).filter((b) => isOpen(b.status)).sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  const recent = (bookings ?? []).filter((b) => !isOpen(b.status)).sort((a, b) => b.start_at.localeCompare(a.start_at)).slice(0, 4);
  const firstName = profile?.full_name?.split(' ')[0];
  const fromPrice = (c: CarerListing) =>
    city && c.services.length ? formatCurrency(Math.min(...c.services.map((s) => s.rate_cents)), city.currency, language) : null;

  const findCare = (params?: Record<string, string>) => router.push({ pathname: '/owner/discover', params });

  return (
    <View style={styles.root}>
      {focused ? <StatusBar style={scrolled ? 'dark' : 'light'} /> : null}
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 280;
          if (past !== scrolled) setScrolled(past);
        }}
      >
        <HeroHeader image={photos.authBanner}>
          <Reveal>
            {isPreview ? <Text variant="overline" color="highlightOnAccent">{tc('preview.banner')}</Text> : null}
            {plus?.active ? (
              <View style={styles.memberBadge}>
                <HeroBadge><Text variant="caption" color="onAccent">{t('plus.member')}</Text></HeroBadge>
              </View>
            ) : null}
            <Text color="onAccentMuted" style={styles.greeting}>
              {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
            </Text>
            <Text variant="display" color="onAccent" style={styles.heroTitle}>{t('home.heroTitle')}</Text>
            <Text color="onAccentMuted">{t('home.subtitle')}</Text>
          </Reveal>
          <Reveal delay={120} style={styles.heroActions}>
            <Pressable onPress={() => findCare()} accessibilityRole="button" style={styles.bookBtn}>
              <Icon name="search" size={18} color="accent" />
              <Text variant="bodyStrong" color="accent">{t('home.book')}</Text>
            </Pressable>
          </Reveal>
        </HeroHeader>

        <View style={styles.body}>
          {flags.length > 0 ? (
            <Reveal>
              <View style={styles.section}>
                <Text variant="overline" color="danger">{tv('flag.homeTitle')}</Text>
                {flags.map((f) => (
                  <Card key={f.id} style={styles.flagCard}>
                    <View style={styles.rowBetween}>
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

          <Reveal delay={140}>
            <Pressable onPress={() => router.push('/owner/assistant')} accessibilityRole="button" style={styles.askCard}>
              <View style={styles.askIcon}>
                <MaterialCommunityIcons name="creation" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" color="onAccent">{t('assistant.title')}</Text>
                <Text variant="caption" color="onAccentMuted">{t('assistant.homeBody')}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="onAccent" directional />
            </Pressable>
          </Reveal>

          <Reveal delay={160} style={styles.section}>
            <Text variant="heading">{t('home.speciesTitle')}</Text>
            <SpeciesPicker onPress={(species) => findCare({ species })} />
          </Reveal>

          <Reveal delay={200} style={styles.section}>
            <SectionHead title={t('home.petsTitle')} action={pets?.length ? t('home.seeAll') : undefined} onAction={() => router.push('/owner/pets')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.hRow}>
              {(pets ?? []).map((p) => (
                <Pressable key={p.id} onPress={() => router.push({ pathname: '/owner/pets/[id]', params: { id: p.id } })} accessibilityRole="button" style={styles.petCard}>
                  <PetAvatar name={p.name} photoPath={p.photo_path} size={64} />
                  <Text variant="bodyStrong" auto numberOfLines={1}>{p.name}</Text>
                  <Text variant="caption" color="inkMuted" numberOfLines={1}>{p.breed || tp(`species.${p.species}`)}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => router.push('/owner/pets/new')} accessibilityRole="button" style={[styles.petCard, styles.addPet]}>
                <View style={styles.addCircle}><Icon name="plus" size={24} color="accent" /></View>
                <Text variant="bodyStrong" color="accent" align="center">{t('home.addPet')}</Text>
              </Pressable>
            </ScrollView>
            {pets && pets.length === 0 ? <Text variant="caption" color="inkMuted">{t('home.noPets')}</Text> : null}
          </Reveal>

          <Reveal delay={240} style={styles.section}>
            <Text variant="heading">{t('home.nextTitle')}</Text>
            {next ? (
              <BookingRow booking={next} role="owner" onPress={() => router.push({ pathname: '/owner/bookings/[id]', params: { id: next.id } })} />
            ) : bookings ? (
              <Card soft>
                <Text color="inkMuted">{t('home.noNext')}</Text>
                <Button label={t('home.findCare')} icon="search" onPress={() => findCare()} style={{ marginTop: space.sm }} />
              </Card>
            ) : null}
          </Reveal>

          <Reveal delay={280} style={styles.section}>
            <SectionHead title={t('home.nearTitle')} action={carers?.length ? t('home.seeAll') : undefined} onAction={() => findCare()} />
            {city ? <Text variant="caption" color="inkMuted">{localized(city.name_i18n, language)}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.hRow}>
              {(carers ?? []).map((c) => {
                const cover = carerCover(c, serviceById);
                return (
                  <Pressable
                    key={c.user_id}
                    onPress={() => router.push({ pathname: '/owner/discover/carer/[id]', params: { id: c.user_id } })}
                    accessibilityRole="button"
                    style={styles.carerCard}
                  >
                    <View style={styles.carerCover}>
                      {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                    </View>
                    <View style={styles.carerBody}>
                      <View style={styles.carerHead}>
                        <CarerAvatar name={c.display_name} path={c.avatar_path} size={36} />
                        <Text variant="bodyStrong" auto numberOfLines={1} style={{ flex: 1 }}>{c.display_name}</Text>
                      </View>
                      {c.rating_count > 0 ? <RatingLabel avg={c.rating_avg} count={c.rating_count} /> : <Chip tone="accent" label={t('home.newCarer')} />}
                      {fromPrice(c) ? <Text variant="caption" color="inkMuted">{tm('discover.from', { price: fromPrice(c) })}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Reveal>

          <Reveal delay={320} style={styles.section}>
            <SectionHead title={t('home.activityTitle')} action={recent.length ? t('home.history') : undefined} onAction={() => router.push('/owner/bookings')} />
            {bookings && recent.length === 0 ? (
              <EmptyState icon="clock" title={t('home.activityTitle')} body={t('home.noActivity')} />
            ) : (
              <Card>
                {recent.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push({ pathname: '/owner/bookings/[id]', params: { id: b.id } })}
                    accessibilityRole="button"
                    style={[styles.activity, i > 0 && styles.activityDivider]}
                  >
                    <View style={[styles.dot, statusTone(b.status) === 'danger' ? styles.dotDanger : statusTone(b.status) === 'accent' ? styles.dotOk : null]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>{localized(b.service.name_i18n, language)}</Text>
                      <Text variant="caption" color="inkMuted" numberOfLines={1} auto>
                        {[b.carer_name ? t('home.with', { name: b.carer_name }) : null, formatDateTime(b.start_at, language, b.timezone)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Chip tone={statusTone(b.status)} label={tb(`status.${b.status}`)} />
                  </Pressable>
                ))}
              </Card>
            )}
          </Reveal>

          {plus && !plus.active ? (
            <Reveal delay={360}>
              <Card style={styles.plusCard}>
                <View style={styles.rowBetween}>
                  <Text variant="heading">{t('plus.title')}</Text>
                  <MaterialCommunityIcons name="star-four-points" size={20} color={colors.highlight} />
                </View>
                <Text color="inkMuted">{t('plus.homeBody')}</Text>
                <Button variant="secondary" label={t('plus.homeCta')} onPress={() => router.push('/owner/plus')} />
              </Card>
            </Reveal>
          ) : null}

          <CitiesStrip cities={cities} />
        </View>
      </ScrollView>
      {scrolled ? <View pointerEvents="none" style={[styles.statusStrip, { height: insets.top }]} /> : null}
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.rowBetween}>
      <Text variant="heading">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.link}>
          <Text variant="caption" color="accent">{action}</Text>
          <Icon name="chevron-right" size={14} color="accent" directional />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Where Nouri is live, and a waitlist link for cities that aren't yet. */
function CitiesStrip({ cities }: { cities: ReturnType<typeof useCities>['cities'] }) {
  const { t } = useTranslation('owner');
  const { t: tc } = useTranslation('common');
  const { t: tv } = useTranslation('visits');
  const { language } = useLocale();
  const router = useRouter();
  if (!cities.length) return null;
  return (
    <View style={styles.section}>
      <Text variant="overline" color="inkMuted">{t('home.citiesTitle')}</Text>
      <View style={styles.chipsWrap}>
        {cities.map((c) => (
          <Pressable
            key={c.id}
            disabled={c.is_active}
            onPress={() => router.push({ pathname: '/waitlist', params: { cityId: c.id } })}
            accessibilityRole={c.is_active ? undefined : 'button'}
            accessibilityHint={c.is_active ? undefined : tv('waitlist.join')}
          >
            <Chip tone={c.is_active ? 'accent' : 'neutral'} label={`${localized(c.name_i18n, language)} · ${c.is_active ? tc('live') : tc('notYetLive')}`} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  statusStrip: { position: 'absolute', top: 0, start: 0, end: 0, backgroundColor: colors.paper, ...shadow.card },
  scroll: { paddingBottom: space.xxxl },
  greeting: { marginTop: space.lg },
  memberBadge: { marginTop: space.md },
  askCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg,
    borderRadius: radius.lg, backgroundColor: colors.accent, ...shadow.raised,
  },
  askIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.highlightOnAccent, alignItems: 'center', justifyContent: 'center' },
  plusCard: { gap: space.sm, borderWidth: 1.5, borderColor: colors.highlightSoft },
  heroTitle: { marginTop: space.xs, marginBottom: space.sm },
  heroActions: { flexDirection: 'row', marginTop: space.xl },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    minHeight: layout.minTouch,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  body: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, gap: space.xxl, marginTop: space.xl },
  section: { gap: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flagCard: { borderWidth: 1.5, borderColor: colors.danger },
  /** Carousels run to the screen edges while their first card lines up with the page margin. */
  bleed: { marginHorizontal: -layout.gutter },
  hRow: { gap: space.md, paddingVertical: space.sm, paddingHorizontal: layout.gutter },
  petCard: { width: 120, padding: space.md, gap: space.xs, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  addPet: { justifyContent: 'center', backgroundColor: colors.accentSoft, shadowOpacity: 0, elevation: 0 },
  addCircle: { width: 64, height: 64, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  carerCard: { width: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow.card },
  carerCover: { height: 120, backgroundColor: colors.sunken },
  carerBody: { padding: space.md, gap: space.xs },
  carerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  activity: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.inkFaint },
  dotOk: { backgroundColor: colors.highlight },
  dotDanger: { backgroundColor: colors.danger },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
