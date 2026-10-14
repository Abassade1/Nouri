import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

import { Button, Card, Chip, Reveal, Screen, ScreenTitle, Text } from '../ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PushCard } from './PushCard';

/** Shared by owner and carer tabs: who you are, language, sign out. */
export function AccountScreen() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation('common');
  const { profile, session, isPreview, signOut } = useAuth();

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('title')} />

      <Reveal delay={80}>
        <Card>
          <Text variant="overline" color="inkFaint">
            {t('signedInAs')}
          </Text>
          <Text variant="heading">{profile?.full_name || session?.user.email}</Text>
          {profile?.full_name && session?.user.email ? (
            <Text color="inkMuted">
              {session.user.email}
            </Text>
          ) : null}
          <View style={styles.chipRow}>{profile?.role ? <Chip tone="accent" label={t(`role.${profile.role}`)} /> : null}</View>
        </Card>
      </Reveal>

      <Reveal delay={160} style={styles.section}>
        <Text variant="heading">{t('language')}</Text>
        <Text variant="caption" color="inkMuted">
          {t('languageHint')}
        </Text>
        <LanguageSwitcher />
      </Reveal>

      <Reveal delay={200} style={styles.section}>
        <PushCard />
      </Reveal>

      <Reveal delay={240} style={styles.section}>
        <Button variant="secondary" label={isPreview ? tc('preview.exit') : t('signOut')} icon="log-out" onPress={() => void signOut()} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginTop: space.sm },
  section: { marginTop: space.xxl, gap: space.md },
});
