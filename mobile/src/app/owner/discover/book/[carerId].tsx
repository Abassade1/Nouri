import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateStrip } from '@/components/features/DateStrip';
import { FormScreen } from '@/components/features/FormScreen';
import { Button, Card, ChipSelect, EmptyState, Icon, OptionCard, Text, TextField } from '@/components/ui';
import { bookingErrorKey } from '@/features/bookings/repo';
import { marketplaceRepo } from '@/features/marketplace/repo';
import type { CarerDetail, CityInfo, ServiceInfo } from '@/features/marketplace/types';
import { petsRepo } from '@/features/pets/repo';
import { visitsRepo } from '@/features/visits/repo';
import { formatClock, formatCurrency, localized } from '@/lib/format';
import { estimatePrice } from '@/lib/pricing';
import { durationMinutes, generateSlots, upcomingDates, weekdayOf, zonedTimeToUtc } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, radius, space } from '@/theme/tokens';
import type { Pet } from '@/types/pets';

export default function BookingFlow() {
  const { t } = useTranslation('marketplace');
  const { language } = useLocale();
  const router = useRouter();
  const { profile } = useAuth();
  const { carerId, flag, service: serviceSlug } = useLocalSearchParams<{ carerId: string; flag?: string; service?: string }>();

  const [detail, setDetail] = useState<CarerDetail | null>(null);
  const [city, setCity] = useState<CityInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [nights, setNights] = useState(1);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = await marketplaceRepo.getCarer(carerId);
      setDetail(d);
      if (!d) return;
      const [cities, svc, myPets] = await Promise.all([
        marketplaceRepo.listCities(), marketplaceRepo.listServices(d.listing.city_id), profile ? petsRepo.listPets(profile.id) : Promise.resolve([]),
      ]);
      setCity(cities.find((c) => c.id === d.listing.city_id) ?? null);
      const offered = svc.filter((s) => d.listing.services.some((x) => x.service_id === s.id));
      setServices(offered);
      const preset = serviceSlug ? offered.find((s) => s.slug === serviceSlug) : null;
      if (preset) setServiceId(preset.id);
      setPets(myPets);
      if (myPets.length === 1) setPetIds([myPets[0].id]);
    })();
  }, [carerId, profile]);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const rate = detail?.listing.services.find((s) => s.service_id === serviceId)?.rate_cents ?? 0;
  const unit = service?.rate_unit ?? 'per_visit';
  const quantity = unit === 'per_night' ? nights : 1;

  // Only days the carer works are offered.
  const days = useMemo(() => {
    if (!city || !detail) return [];
    return upcomingDates(city.timezone, 28).filter((d) => detail.availability.some((w) => w.weekday === weekdayOf(d)));
  }, [city, detail]);

  const slots = useMemo(() => {
    if (!city || !detail || !date || !service) return [];
    return generateSlots(detail.availability.filter((w) => w.weekday === weekdayOf(date)), { date, tz: city.timezone, unit, quantity });
  }, [city, detail, date, service, unit, quantity]);

  useEffect(() => { if (time && !slots.includes(time)) setTime(null); }, [slots, time]);

  const price = city && service ? estimatePrice(rate, quantity, city.tax_components) : null;
  const money = (cents: number) => formatCurrency(cents, city?.currency ?? 'CAD', language);

  const submit = async () => {
    setError(null);
    if (!service) return setError(t('book.pickService'));
    if (!date) return setError(t('book.pickDate'));
    if (!time) return setError(t('book.pickTime'));
    if (petIds.length === 0) return setError(t('book.pickPet'));
    if (!city || !profile) return;
    const start = zonedTimeToUtc(date, time, city.timezone);
    const end = new Date(start.getTime() + durationMinutes(unit, quantity) * 60000);
    setBusy(true);
    try {
      const bookingId = await marketplaceRepo.createBooking(profile.id, {
        carerId, serviceId: service.id, startAt: start.toISOString(), endAt: end.toISOString(), quantity, petIds, notes: notes.trim() || null,
      });
      // A taxi booked from a concern is recorded against that concern, so the story is complete.
      if (flag && service.slug === 'pet_taxi') await visitsRepo.addFlagAction(flag, 'booked_pet_taxi', { taxiBookingId: bookingId }).catch(() => {});
      setSent(true);
    } catch (e) {
      setError(t(`book.errors.${bookingErrorKey(e)}`));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <FormScreen title="" footer={<Button label={t('book.viewBookings')} onPress={() => router.navigate('/owner/bookings')} />}>
        <EmptyState icon="check-circle" title={t('book.sentTitle')} body={t('book.sentBody', { name: detail?.listing.display_name ?? '' })} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('book.title')}
      intro={detail?.listing.display_name ?? undefined}
      footer={<View style={{ gap: space.sm }}>{error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}<Button label={busy ? t('book.submitting') : t('book.submit')} onPress={submit} loading={busy} /></View>}
    >
      <Text variant="overline" color="accent">{t('book.service')}</Text>
      {services.map((s) => (
        <OptionCard
          key={s.id}
          title={localized(s.name_i18n, language)}
          body={`${money(detail?.listing.services.find((x) => x.service_id === s.id)?.rate_cents ?? 0)} ${t(`units.${s.rate_unit}`)}`}
          selected={serviceId === s.id}
          onPress={() => { setServiceId(s.id); setTime(null); }}
        />
      ))}

      {unit === 'per_night' ? (
        <View style={styles.stepper}>
          <Text style={{ flex: 1 }}>{t('book.nights')}</Text>
          <Pressable onPress={() => setNights((n) => Math.max(1, n - 1))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="-"><Icon name="minus" size={18} /></Pressable>
          <Text variant="heading" style={{ minWidth: 28 }} align="center">{nights}</Text>
          <Pressable onPress={() => setNights((n) => Math.min(30, n + 1))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="+"><Icon name="plus" size={18} /></Pressable>
        </View>
      ) : null}

      {service ? (
        <>
          <Text variant="overline" color="accent">{t('book.date')}</Text>
          <DateStrip dates={days} selected={date} onSelect={setDate} />
          {date ? (
            <>
              <Text variant="overline" color="accent">{t('book.time')}</Text>
              {slots.length === 0 ? <Text color="inkFaint">{t('book.noSlots')}</Text> : (
                <ChipSelect options={slots.map((s) => ({ value: s, label: formatClock(s, language) }))} selected={time ? [time] : []} onChange={(v) => setTime(v[0])} />
              )}
            </>
          ) : null}
        </>
      ) : null}

      <Text variant="overline" color="accent">{t('book.pets')}</Text>
      {pets.length === 0 ? (
        <>
          <Text color="inkMuted">{t('book.noPets')}</Text>
          <Button variant="secondary" icon="plus" label={t('book.addPet')} onPress={() => router.push('/owner/pets/new')} />
        </>
      ) : (
        <ChipSelect multiple options={pets.map((p) => ({ value: p.id, label: p.name }))} selected={petIds} onChange={setPetIds} />
      )}

      <TextField label={t('book.notes')} hint={t('book.notesHint')} value={notes} onChangeText={setNotes} multiline />

      {price ? (
        <Card soft>
          <Text variant="overline" color="inkMuted">{t('book.summary')}</Text>
          <View style={styles.line}><Text color="inkMuted">{t('book.subtotal')}</Text><Text>{money(price.subtotal)}</Text></View>
          {price.taxes.map((x) => <View key={x.code} style={styles.line}><Text color="inkMuted">{x.code}</Text><Text>{money(x.cents)}</Text></View>)}
          <View style={styles.line}><Text variant="bodyStrong">{t('book.total')}</Text><Text variant="bodyStrong">{money(price.total)}</Text></View>
          <Text variant="caption" color="inkFaint">{t('book.estimate')}</Text>
        </Card>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md },
  stepBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
});
