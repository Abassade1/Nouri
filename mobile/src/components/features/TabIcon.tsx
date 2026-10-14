import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

export type TabIconName = ComponentProps<typeof Feather>['name'];

/** Tab bar icon; color is supplied by the navigator (active vs inactive). */
export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  return <Feather name={name} size={22} color={color} />;
}
