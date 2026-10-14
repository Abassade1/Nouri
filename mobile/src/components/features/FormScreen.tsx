import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { Reveal, Screen, Text } from '../ui';
import { BackLink } from './BackLink';

/** Standard frame for a form step: back link, title, intro, content, pinned action. */
export function FormScreen({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Screen footer={footer}>
      <BackLink />
      <Reveal>
        <Text variant="title">{title}</Text>
        {intro ? (
          <Text color="inkMuted" style={styles.intro}>
            {intro}
          </Text>
        ) : null}
      </Reveal>
      <View style={styles.body}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.sm },
  body: { marginTop: space.xl, gap: space.lg },
});
