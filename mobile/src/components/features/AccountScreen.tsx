import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePlus } from '@/features/plus/usePlus';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

import { Button, Card, Chip, Reveal, Screen, ScreenTitle, Text } from '../ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ProfilePhoto } from './ProfilePhoto';
import { PushCard } from './PushCard';

/** Shared by owner and carer tabs: who you are, language, sign out. */
export function AccountScreen() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation('common');
  const { profile, session, isPreview, signOut } = useAuth();
  const { t: to } = useTranslation('owner');
  const router = useRouter();
  const { status: plus } = usePlus();

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('title')} />

      <Reveal delay={80}>
        <Card>
          <ProfilePhoto />
          <View style={styles.divider} />
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

      {profile?.role === 'owner' && plus ? (
        <Reveal delay={120} style={styles.section}>
          <Card>
            <Text variant="heading">{to('plus.title')}</Text>
            <Text color="inkMuted">{plus.active ? to('plus.active') : to('plus.homeBody')}</Text>
            <Button
              variant={plus.active ? 'secondary' : 'primary'}
              icon="star"
              label={plus.active ? to('plus.manage') : to('plus.homeCta')}
              onPress={() => router.push('/owner/plus')}
              style={{ marginTop: space.sm }}
            />
          </Card>
        </Reveal>
      ) : null}

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
  divider: { height: space.md },
  section: { marginTop: space.xxl, gap: space.md },
});
