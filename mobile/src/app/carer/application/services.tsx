import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Card, Icon, Text, TextField } from '@/components/ui';
import { applicationRepo, type CityOption, type OfferableService } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';
import { formatPercent, localized } from '@/lib/format';
import { parseRateToCents } from '@/lib/money';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, space } from '@/theme/tokens';

export default function ServicesStep() {
  const { t } = useTranslation('application');
  const router = useRouter();
  const { language } = useLocale();
  const { data, userId, locked } = useApplication();

  const [services, setServices] = useState<OfferableService[]>([]);
  const [city, setCity] = useState<CityOption | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({}); // service id -> text; absent = not offered
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const cityId = data?.profile?.city_id ?? null;

  useEffect(() => {
    if (!data || loaded) return;
    if (!cityId) {
      setLoaded(true);
      return;
    }
    void (async () => {
      const [list, cities] = await Promise.all([applicationRepo.listServicesForCity(cityId), applicationRepo.listOpenCities()]);
      setServices(list);
      setCity(cities.find((c) => c.id === cityId) ?? null);
      const initial: Record<string, string> = {};
      for (const s of data.services) if (s.is_active) initial[s.service_id] = String(s.rate_cents / 100);
      setRates(initial);
      setLoaded(true);
    })();
  }, [data, loaded, cityId]);

  const toggle = (id: string) =>
    setRates((r) => {
      const next = { ...r };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });

  const save = async () => {
    const next: Record<string, string> = {};
    const toSave: [string, number | null][] = [];
    for (const s of services) {
      if (s.id in rates) {
        const cents = parseRateToCents(rates[s.id]);
        if (cents === null) next[s.id] = t('services.invalidRate');
        else toSave.push([s.id, cents]);
      } else toSave.push([s.id, null]);
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      for (const [id, cents] of toSave) await applicationRepo.setRate(userId, id, cents);
      router.back();
    } catch {
      setErrors({ form: t('errors.locked') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={t('services.title')}
      intro={cityId ? t('services.intro') : undefined}
      footer={!locked && cityId ? <Button label={t('services.save')} onPress={save} loading={busy} /> : undefined}
    >
      {!cityId ? <Text color="inkMuted">{t('services.noCity')}</Text> : null}
      {services.map((s) => {
        const on = s.id in rates;
        return (
          <Card key={s.id}>
            <Pressable onPress={() => !locked && toggle(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.head}>
              <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={14} color="onAccent" /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{localized(s.name_i18n, language)}</Text>
                <Text variant="caption" color="inkMuted">{t('services.offer')} · {t(`services.unit.${s.rate_unit}`)}</Text>
              </View>
            </Pressable>
            {on ? (
              <TextField
                label={`${t('services.rate')} (${city?.currency ?? ''} ${t(`services.unit.${s.rate_unit}`)})`}
                value={rates[s.id]}
                onChangeText={(v) => setRates((r) => ({ ...r, [s.id]: v }))}
                error={errors[s.id]}
                keyboardType="decimal-pad"
                ltr
                editable={!locked}
              />
            ) : null}
          </Card>
        );
      })}
      {city && cityId ? (
        <Text variant="caption" color="inkMuted">
          {t('services.commissionNote', { percent: formatPercent(city.commission_rate, language) })}
        </Text>
      ) : null}
      {errors.form ? <Text variant="caption" color="danger">{errors.form}</Text> : null}
      <View />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
