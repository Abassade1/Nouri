import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { space } from '@/theme/tokens';

import { Icon, Text } from '../ui';

/** Back affordance whose arrow mirrors automatically in right-to-left languages. */
export function BackLink() {
  const router = useRouter();
  const { t } = useTranslation('common');
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      accessibilityRole="button"
      accessibilityLabel={t('back')}
      hitSlop={12}
      style={styles.row}
    >
      <Icon name="arrow-left" size={20} directional />
      <Text variant="caption" color="inkMuted">
        {t('back')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', marginBottom: space.xxl },
});
