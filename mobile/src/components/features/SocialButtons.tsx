import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { toAppError } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme/tokens';

import { Button, Text } from '../ui';

/** "or" divider + Apple (iOS only) and Google buttons. */
export function SocialButtons({ onError }: { onError: (message: string) => void }) {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const { t: te } = useTranslation('errors');
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (kind: 'apple' | 'google') => {
    setBusy(kind);
    try {
      await (kind === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch (e) {
      const key = toAppError(e).key;
      if (key !== 'socialCancelled') onError(te(key));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.or}>
        <View style={styles.line} />
        <Text variant="caption" color="inkFaint">
          {tc('or')}
        </Text>
        <View style={styles.line} />
      </View>
      {appleAvailable ? (
        <Button variant="secondary" icon="smartphone" label={t('social.apple')} loading={busy === 'apple'} onPress={() => run('apple')} />
      ) : null}
      <Button variant="secondary" icon="globe" label={t('social.google')} loading={busy === 'google'} onPress={() => run('google')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginTop: space.xl },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
});
