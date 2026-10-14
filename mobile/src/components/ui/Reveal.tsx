import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

/** Gentle fade-and-rise on mount. Skipped when the user has "reduce motion" on. */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(motion.slow).delay(delay).springify().damping(22)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
