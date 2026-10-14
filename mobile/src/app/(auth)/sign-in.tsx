import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { SocialButtons } from '@/components/features/SocialButtons';
import { Button, Reveal, Screen, Text, TextField } from '@/components/ui';
import { toAppError } from '@/lib/errors';
import { isValidEmail } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

export default function SignIn() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = te('invalidEmail');
    if (!password) next.password = te('required');
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await signInWithEmail(email, password);
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
          {t('signIn.title')}
        </Text>
        <Text color="inkMuted">{t('signIn.subtitle')}</Text>
      </Reveal>

      <Reveal delay={100} style={styles.form}>
        <TextField
          label={t('signIn.email')}
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
          label={t('signIn.password')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          ltr
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {errors.form ? (
          <Text variant="caption" color="danger">
            {errors.form}
          </Text>
        ) : null}
        <Button label={t('signIn.submit')} onPress={submit} loading={busy} />
      </Reveal>

      <Reveal delay={200}>
        <SocialButtons onError={(message) => setErrors({ form: message })} />
      </Reveal>

      <View style={styles.switch}>
        <Text color="inkMuted">{t('signIn.noAccount')}</Text>
        <Link href="/sign-up" replace>
          <Text color="accent" variant="bodyStrong">
            {t('signIn.createLink')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  form: { marginTop: space.xxl, gap: space.lg },
  switch: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', marginTop: space.xxl },
});
