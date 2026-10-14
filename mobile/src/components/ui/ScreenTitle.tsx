import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { Reveal } from './Reveal';
import { Text } from './Text';

/** Small label above a large title: the signature header of every top-level screen. */
export function ScreenTitle({ overline, title, subtitle }: { overline?: string; title: string; subtitle?: string }) {
  return (
    <Reveal>
      <View style={styles.wrap}>
        {overline ? (
          <Text variant="overline" color="highlight">
            {overline}
          </Text>
        ) : null}
        <Text variant="display">{title}</Text>
        {subtitle ? <Text color="inkMuted">{subtitle}</Text> : null}
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.sm, marginBottom: space.xxl } });
