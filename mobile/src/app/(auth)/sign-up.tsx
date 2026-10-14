import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { SocialButtons } from '@/components/features/SocialButtons';
import { Button, Checkbox, OptionCard, Reveal, Screen, Text, TextField } from '@/components/ui';
import { APP_NAME } from '@/config/app';
import { toAppError } from '@/lib/errors';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

type Role = 'owner' | 'carer';

export default function SignUp() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const { language } = useLocale();
  const { signUpWithEmail } = useAuth();

  const [role, setRole] = useState<Role>('owner');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!fullName.trim()) next.fullName = te('required');
    if (!isValidEmail(email)) next.email = te('invalidEmail');
    if (password.length < MIN_PASSWORD_LENGTH) next.password = te('weakPassword');
    if (!consent) next.consent = te('consentRequired');
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail({ email, password, fullName, role, language });
      if (needsEmailConfirmation) router.replace({ pathname: '/check-email', params: { email: email.trim() } });
      // otherwise the session is live and the navigation guards take over
    } catch (e) {
      setErrors({ form: te(toAppError(e).key) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <Text variant="display" style={styles.title}>
          {t('signUp.title')}
        </Text>
        <Text color="inkMuted">{t('signUp.subtitle')}</Text>
      </Reveal>

      <Reveal delay={80} style={styles.block}>
        <Text variant="overline" color="inkMuted">
          {t('signUp.iAm')}
        </Text>
        <OptionCard title={t('signUp.roleOwner')} body={t('signUp.roleOwnerHint')} selected={role === 'owner'} onPress={() => setRole('owner')} />
        <OptionCard title={t('signUp.roleCarer')} body={t('signUp.roleCarerHint')} selected={role === 'carer'} onPress={() => setRole('carer')} />
      </Reveal>

      <Reveal delay={160} style={styles.form}>
        <TextField label={t('signUp.fullName')} value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" textContentType="name" />
        <TextField
          label={t('signUp.email')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          ltr
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label={t('signUp.password')}
          hint={t('signUp.passwordHint')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          ltr
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Checkbox checked={consent} onToggle={() => setConsent((c) => !c)} label={t('signUp.consent', { appName: APP_NAME })} error={errors.consent} />
        {errors.form ? (
          <Text variant="caption" color="danger">
            {errors.form}
          </Text>
        ) : null}
        <Button label={t('signUp.submit')} onPress={submit} loading={busy} />
      </Reveal>

      <Reveal delay={240}>
        <SocialButtons onError={(message) => setErrors({ form: message })} />
      </Reveal>

      <View style={styles.switch}>
        <Text color="inkMuted">{t('signUp.haveAccount')}</Text>
        <Link href="/sign-in" replace>
          <Text color="accent" variant="bodyStrong">
            {t('signUp.signInLink')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  block: { marginTop: space.xxl, gap: space.md },
  form: { marginTop: space.xxl, gap: space.lg },
  switch: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', marginTop: space.xxl },
});
