import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { Wordmark } from '@/components/features/Wordmark';
import { Button, Reveal, Screen, Text } from '@/components/ui';
import { PREVIEW_MODE } from '@/config/app';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

export default function Welcome() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const { t: tv } = useTranslation('visits');
  const router = useRouter();
  const { startPreview } = useAuth();

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <View style={styles.actions}>
          <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
          <Button variant="secondary" label={t('welcome.signIn')} onPress={() => router.push('/sign-in')} />
          <Button variant="ghost" label={tv('waitlist.link')} onPress={() => router.push('/waitlist')} />
          {PREVIEW_MODE ? (
            <View style={styles.preview}>
              <Button variant="ghost" label={tc('preview.asOwner')} onPress={() => startPreview('owner')} />
              <Button variant="ghost" label={tc('preview.asCarer')} onPress={() => startPreview('carer')} />
              <Button variant="ghost" label={tc('preview.asAdmin')} onPress={() => startPreview('admin')} />
            </View>
          ) : null}
        </View>
      }
    >
      <Reveal>
        <Wordmark />
      </Reveal>

      <View style={styles.hero}>
        <Reveal delay={120}>
          <Text variant="display">{t('welcome.title')}</Text>
        </Reveal>
        <Reveal delay={240}>
          <Text color="inkMuted" style={styles.sub}>
            {t('welcome.subtitle')}
          </Text>
        </Reveal>
      </View>

      <Reveal delay={360} style={styles.lang}>
        <LanguageSwitcher />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xxl },
  hero: { marginTop: 72, gap: space.lg },
  sub: { maxWidth: 420 },
  lang: { marginTop: space.xxxl },
  actions: { gap: space.md },
  preview: { marginTop: space.sm },
});
