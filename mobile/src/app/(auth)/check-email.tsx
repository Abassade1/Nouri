import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function CheckEmail() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen
      contentStyle={styles.content}
      footer={<Button variant="secondary" label={t('checkEmail.backToSignIn')} onPress={() => router.replace('/sign-in')} />}
    >
      <EmptyState icon="mail" title={t('checkEmail.title')} body={t('checkEmail.body', { email: email ?? '' })} />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { justifyContent: 'center', paddingTop: space.xxxl } });
