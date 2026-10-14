import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors } from '@/theme/tokens';

type TabOptions = Extract<ComponentProps<typeof Tabs>['screenOptions'], object>;

/** Shared look for both role tab bars. `fontFamily` comes from the active language. */
export function tabScreenOptions(fontFamily: string | undefined): TabOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.inkFaint,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      elevation: 8,
      shadowColor: colors.accent,
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
    },
    tabBarLabelStyle: { fontFamily, fontSize: 11, marginTop: -2 },
    sceneStyle: { backgroundColor: colors.paper },
  };
}
