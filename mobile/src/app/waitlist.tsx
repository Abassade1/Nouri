import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Checkbox, ChipSelect, EmptyState, Text, TextField } from '@/components/ui';
import { APP_NAME } from '@/config/app';
import { useCities } from '@/features/useCities';
import { visitsRepo } from '@/features/visits/repo';
import { localized } from '@/lib/format';
import { isValidEmail } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

const OTHER = '__other__';

/** Open to everyone, signed in or not: "tell us where you are and we'll write when we arrive". */
export default function Waitlist() {
  const { t } = useTranslation('visits');
  const { language } = useLocale();
  const { session, profile } = useAuth();
  const { cities } = useCities();
  const { cityId: preselect } = useLocalSearchParams<{ cityId?: string }>();

  const waiting = cities.filter((c) => !c.is_active);
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [choice, setChoice] = useState<string | null>(preselect ?? null);
  const [otherCity, setOtherCity] = useState('');
  const [interest, setInterest] = useState<'owner' | 'carer'>(profile?.role === 'carer' ? 'carer' : 'owner');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { if (!choice && waiting.length) setChoice(preselect ?? waiting[0].id); }, [waiting.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = t('waitlist.errors.email');
    if (choice === OTHER && !otherCity.trim()) next.city = t('waitlist.errors.city');
    if (!choice) next.city = t('waitlist.errors.city');
    if (!consent) next.consent = t('waitlist.errors.consent');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const city = waiting.find((c) => c.id === choice);
      await visitsRepo.joinWaitlist({
        email, cityId: choice === OTHER ? null : choice, requestedCity: choice === OTHER ? otherCity.trim() : null,
        interest, language, userId: profile?.id ?? null,
      });
      setDone(choice === OTHER ? otherCity.trim() : localized(city?.name_i18n, language));
    } catch {
      setErrors({ form: t('waitlist.errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <FormScreen title="">
        <EmptyState icon="check-circle" title={t('waitlist.doneTitle')} body={t('waitlist.doneBody', { appName: APP_NAME, city: done })} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('waitlist.title')}
      intro={t('waitlist.intro')}
      footer={<View style={{ gap: space.sm }}>{errors.form ? <Text variant="caption" color="danger" align="center">{errors.form}</Text> : null}<Button label={t('waitlist.submit')} onPress={submit} loading={busy} /></View>}
    >
      <TextField label={t('waitlist.email')} value={email} onChangeText={setEmail} error={errors.email} ltr autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Text variant="overline" color="accent">{t('waitlist.city')}</Text>
      <ChipSelect
        options={[...waiting.map((c) => ({ value: c.id, label: localized(c.name_i18n, language) })), { value: OTHER, label: t('waitlist.other') }]}
        selected={choice ? [choice] : []}
        onChange={(v) => setChoice(v[0])}
      />
      {choice === OTHER ? <TextField label={t('waitlist.cityName')} value={otherCity} onChangeText={setOtherCity} /> : null}
      {errors.city ? <Text variant="caption" color="danger">{errors.city}</Text> : null}
      <Text variant="overline" color="accent">{t('waitlist.iAm')}</Text>
      <ChipSelect options={[{ value: 'owner', label: t('waitlist.owner') }, { value: 'carer', label: t('waitlist.carer') }]} selected={[interest]} onChange={(v) => setInterest(v[0] as 'owner' | 'carer')} />
      <Checkbox checked={consent} onToggle={() => setConsent((c) => !c)} label={t('waitlist.consent', { appName: APP_NAME })} error={errors.consent} />
    </FormScreen>
  );
}
