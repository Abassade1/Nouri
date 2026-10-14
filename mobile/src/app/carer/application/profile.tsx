import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, ChipSelect, OptionCard, Text, TextField } from '@/components/ui';
import { applicationRepo, type CityOption } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';
import { localized } from '@/lib/format';
import { normalizePostalCode } from '@/lib/postal';
import { useLocale } from '@/providers/LocaleProvider';

const SPECIALTIES = ['senior_care', 'medication', 'anxious_pets', 'puppies', 'large_breeds', 'special_needs'] as const;
const LANGS = ['en', 'fr', 'ar', 'zh', 'es', 'pa'] as const;

export default function ProfileStep() {
  const { t } = useTranslation('application');
  const router = useRouter();
  const { language } = useLocale();
  const { data, userId, locked } = useApplication();

  const [cities, setCities] = useState<CityOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cityId, setCityId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState('');
  const [radius, setRadius] = useState('10');
  const [postal, setPostal] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void applicationRepo.listOpenCities().then(setCities);
  }, []);

  // Fill the form once, from the saved application.
  useEffect(() => {
    if (!data || loaded) return;
    const p = data.profile;
    setCityId(p?.city_id ?? null);
    setDisplayName(p?.display_name ?? '');
    setHeadline(p?.headline ?? '');
    setBio(p?.bio ?? '');
    setYears(p?.years_experience != null ? String(p.years_experience) : '');
    setRadius(String(p?.service_radius_km ?? 10));
    setPostal(p?.postal_code ?? '');
    setLangs(p?.languages_spoken ?? []);
    setSpecialties(p?.specialties ?? []);
    setLoaded(true);
  }, [data, loaded]);

  const city = cities.find((c) => c.id === cityId) ?? (cities.length === 1 ? cities[0] : undefined);

  const save = async () => {
    const next: typeof errors = {};
    if (!city) next.city = t('errors.required');
    if (!displayName.trim()) next.displayName = t('errors.required');
    if (!bio.trim()) next.bio = t('errors.required');
    const normalized = city ? normalizePostalCode(postal, city.postal_code_regex) : null;
    if (!normalized) next.postal = t('errors.invalidPostal', { example: city?.postal_code_example ?? '' });
    setErrors(next);
    if (Object.keys(next).length || !city || !normalized) return;

    setBusy(true);
    try {
      await applicationRepo.saveProfile(userId, {
        city_id: city.id,
        country_code: city.country_code,
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim(),
        years_experience: years ? Math.max(0, Math.min(60, parseInt(years, 10) || 0)) : null,
        service_radius_km: Math.max(1, Math.min(100, parseInt(radius, 10) || 10)),
        postal_code: normalized,
        languages_spoken: langs,
        specialties,
      });
      router.back();
    } catch {
      setErrors({ form: t('errors.locked') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={t('profile.title')}
      footer={!locked ? <Button label={busy ? t('profile.saving') : t('profile.save')} onPress={save} loading={busy} /> : undefined}
    >
      <Text variant="overline" color="inkMuted">{t('profile.city')}</Text>
      {cities.length === 0 ? (
        <Text color="inkMuted">{t('profile.noCities')}</Text>
      ) : (
        cities.map((c) => (
          <OptionCard key={c.id} title={localized(c.name_i18n, language)} selected={city?.id === c.id} onPress={() => setCityId(c.id)} />
        ))
      )}
      {errors.city ? <Text variant="caption" color="danger">{errors.city}</Text> : <Text variant="caption" color="inkFaint">{t('profile.cityHint')}</Text>}

      <TextField label={t('profile.displayName')} value={displayName} onChangeText={setDisplayName} error={errors.displayName} editable={!locked} />
      <TextField label={t('profile.headline')} hint={t('profile.headlineHint')} value={headline} onChangeText={setHeadline} editable={!locked} />
      <TextField label={t('profile.bio')} hint={t('profile.bioHint')} value={bio} onChangeText={setBio} error={errors.bio} multiline editable={!locked} />
      <TextField label={t('profile.years')} value={years} onChangeText={(v) => setYears(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr editable={!locked} />

      <Text variant="overline" color="inkMuted">{t('profile.languages')}</Text>
      <ChipSelect multiple options={LANGS.map((l) => ({ value: l, label: t(`languages.${l}`) }))} selected={langs} onChange={locked ? () => {} : setLangs} />

      <Text variant="overline" color="inkMuted">{t('profile.specialties')}</Text>
      <ChipSelect multiple options={SPECIALTIES.map((s) => ({ value: s, label: t(`specialties.${s}`) }))} selected={specialties} onChange={locked ? () => {} : setSpecialties} />

      <TextField label={t('profile.radius')} value={radius} onChangeText={(v) => setRadius(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr editable={!locked} />
      <TextField
        label={t('profile.postalCode')}
        hint={t('profile.postalHint')}
        value={postal}
        onChangeText={setPostal}
        error={errors.postal}
        ltr
        autoCapitalize="characters"
        autoComplete="postal-code"
        editable={!locked}
      />
      {errors.form ? <Text variant="caption" color="danger">{errors.form}</Text> : null}
    </FormScreen>
  );
}
