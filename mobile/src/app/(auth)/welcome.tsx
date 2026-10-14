import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageMenu } from '@/components/features/LanguageMenu';
import { Wordmark } from '@/components/features/Wordmark';
import { Button, HeroBadge, HeroHeader, Reveal, Text } from '@/components/ui';
import { PREVIEW_MODE } from '@/config/app';
import { photos } from '@/features/media/serviceImages';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, space } from '@/theme/tokens';

export default function Welcome() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const { t: tv } = useTranslation('visits');
  const router = useRouter();
  const { startPreview } = useAuth();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.lg }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {focused ? <StatusBar style="light" /> : null}
      <HeroHeader image={photos.welcomeHero}>
        <Reveal style={styles.topBar}>
          <Wordmark light />
          <LanguageMenu light />
        </Reveal>

        <View style={styles.hero}>
          <Reveal delay={100}>
            <HeroBadge>
              <Text variant="caption" color="onAccent">
                {t('welcome.badge')}
              </Text>
            </HeroBadge>
          </Reveal>
          <Reveal delay={180}>
            <Text variant="display" color="onAccent" style={styles.title}>
              {t('welcome.title')}
            </Text>
          </Reveal>
          <Reveal delay={260}>
            <Text color="onAccentMuted" style={styles.sub}>
              {t('welcome.subtitle')}
            </Text>
          </Reveal>
        </View>
      </HeroHeader>

      <View style={styles.body}>
        <Reveal delay={420} style={styles.actions}>
          <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
          <Button variant="secondary" label={t('welcome.signIn')} onPress={() => router.push('/sign-in')} />
          <Button variant="ghost" label={tv('waitlist.link')} onPress={() => router.push('/waitlist')} />
        </Reveal>

        {PREVIEW_MODE ? (
          <View style={styles.preview}>
            <Button variant="ghost" label={tc('preview.asOwner')} onPress={() => startPreview('owner')} />
            <Button variant="ghost" label={tc('preview.asCarer')} onPress={() => startPreview('carer')} />
            <Button variant="ghost" label={tc('preview.asAdmin')} onPress={() => startPreview('admin')} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  hero: { marginTop: space.xxxl + space.lg, gap: space.lg },
  title: { fontSize: 36, lineHeight: 44 },
  sub: { maxWidth: 420 },
  body: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    marginTop: space.xl,
    gap: space.xl,
  },
  actions: { gap: space.md },
  preview: {
    marginTop: space.sm,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: space.xs,
  },
});
