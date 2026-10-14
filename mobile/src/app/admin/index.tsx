import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

/** Admins work in the web dashboard; the mobile app just points them there. */
export default function AdminInfo() {
  const { t } = useTranslation('admin');
  const { t: ta } = useTranslation('account');
  const { signOut } = useAuth();
  return (
    <Screen footer={<Button variant="secondary" label={ta('signOut')} onPress={() => void signOut()} />}>
      <EmptyState icon="monitor" title={t('title')} body={t('body')} />
      <View style={{ marginTop: space.xl }}>
        <LanguageSwitcher />
      </View>
    </Screen>
  );
}
