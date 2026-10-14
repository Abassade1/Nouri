import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Icon name={icon} size={28} color="highlight" />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text color="inkMuted" align="center" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxxl, gap: space.md },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.highlightSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  body: { maxWidth: 320 },
});
