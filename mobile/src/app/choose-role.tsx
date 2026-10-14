import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button, OptionCard, Reveal, Screen, Text } from '@/components/ui';
import { APP_NAME } from '@/config/app';
import { toAppError } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

/** Shown once, after signing in with Apple/Google for the first time. */
export default function ChooseRole() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { t: tc } = useTranslation('common');
  const { chooseRole } = useAuth();
  const [role, setRole] = useState<'owner' | 'carer'>('owner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await chooseRole(role);
    } catch (e) {
      setError(te(toAppError(e).key));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label={busy ? t('chooseRole.saving') : tc('continue')} onPress={submit} loading={busy} />}>
      <Reveal>
        <Text variant="display" style={styles.title}>
          {t('chooseRole.title', { appName: APP_NAME })}
        </Text>
        <Text color="inkMuted">{t('chooseRole.subtitle')}</Text>
      </Reveal>
      <Reveal delay={100} style={styles.options}>
        <OptionCard title={t('chooseRole.owner')} body={t('chooseRole.ownerBody')} selected={role === 'owner'} onPress={() => setRole('owner')} />
        <OptionCard title={t('chooseRole.carer')} body={t('chooseRole.carerBody')} selected={role === 'carer'} onPress={() => setRole('carer')} />
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  options: { marginTop: space.xxl, gap: space.md },
});
