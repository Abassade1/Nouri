import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/features/BackLink';
import { Button, Card, Icon, Reveal, Screen, Text } from '@/components/ui';
import { applicationRepo } from '@/features/carer/repo';
import { applicationErrorKey, computeProgress, isComplete, type SectionKey } from '@/features/carer/progress';
import { useApplication } from '@/features/carer/useApplication';
import { colors, radius, space } from '@/theme/tokens';

const SECTIONS: { key: SectionKey; href: Href; icon: 'user' | 'tag' | 'award' | 'users' | 'shield' }[] = [
  { key: 'profile', href: '/carer/application/profile', icon: 'user' },
  { key: 'services', href: '/carer/application/services', icon: 'tag' },
  { key: 'credentials', href: '/carer/application/credentials', icon: 'award' },
  { key: 'references', href: '/carer/application/references', icon: 'users' },
  { key: 'consent', href: '/carer/application/consent', icon: 'shield' },
];

export default function ApplicationHub() {
  const { t } = useTranslation('application');
  const router = useRouter();
  const { data, status, locked, refresh, userId } = useApplication();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <Screen><BackLink /></Screen>;

  const progress = computeProgress(data);
  const ready = isComplete(progress);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await applicationRepo.submit(userId);
      await refresh();
    } catch (e) {
      const key = applicationErrorKey(e);
      setError(key ? t(`errors.${key}`) : t('errors.locked'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        !locked && status !== 'approved' ? (
          <View style={{ gap: space.sm }}>
            {error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}
            <Text variant="caption" color="inkMuted" align="center">{ready ? t('hub.readyHint') : t('hub.notReadyHint')}</Text>
            <Button label={busy ? t('hub.submitting') : t('hub.submit')} onPress={submit} loading={busy} disabled={!ready} />
          </View>
        ) : undefined
      }
    >
      <BackLink />
      <Reveal>
        <Text variant="title">{t('hub.title')}</Text>
        <Text color="inkMuted" style={{ marginTop: space.sm }}>{t('hub.subtitle')}</Text>
      </Reveal>

      {locked ? (
        <Card soft style={{ marginTop: space.xl }}>
          <Text>{t('hub.lockedPending')}</Text>
        </Card>
      ) : null}

      {status === 'rejected' ? (
        <Card style={[styles.rejected, { marginTop: space.xl }]}>
          <Text variant="bodyStrong" color="danger">{t('hub.rejectedTitle')}</Text>
          {data.profile?.rejection_reason ? (
            <>
              <Text variant="overline" color="inkFaint">{t('hub.rejectedNotes')}</Text>
              <Text>{data.profile.rejection_reason}</Text>
            </>
          ) : null}
          <Text variant="caption" color="inkMuted">{t('hub.rejectedHelp')}</Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {SECTIONS.map((s, i) => (
          <Reveal key={s.key} delay={80 + i * 50}>
            <Pressable
              onPress={() => router.push(s.href)}
              accessibilityRole="button"
              style={styles.row}
            >
              <View style={[styles.icon, progress[s.key] && styles.iconDone]}>
                <Icon name={progress[s.key] ? 'check' : s.icon} size={18} color={progress[s.key] ? 'onAccent' : 'accent'} />
              </View>
              <View style={styles.rowText}>
                <Text variant="bodyStrong">{t(`hub.sections.${s.key}`)}</Text>
                <Text variant="caption" color="inkMuted">{t(`hub.sections.${s.key}Body`)}</Text>
              </View>
              <Text variant="caption" color={progress[s.key] ? 'accent' : 'inkFaint'}>
                {progress[s.key] ? t('hub.complete') : t('hub.incomplete')}
              </Text>
              <Icon name="chevron-right" size={18} color="inkFaint" directional />
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.xl, gap: space.md },
  rejected: { borderColor: colors.danger },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
  },
  rowText: { flex: 1, gap: 2 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.accent },
});
