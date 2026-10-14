import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useLocale } from '@/providers/LocaleProvider';
import { colors, type ColorToken } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Feather>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: ColorToken;
  /** Set for icons that imply direction (chevrons, arrows, back). They flip in right-to-left. */
  directional?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 20, color = 'ink', directional = false, style }: Props) {
  const { isRTL } = useLocale();
  return (
    <Feather
      name={name}
      size={size}
      color={colors[color]}
      style={[directional && isRTL ? { transform: [{ scaleX: -1 }] } : null, style]}
    />
  );
}
