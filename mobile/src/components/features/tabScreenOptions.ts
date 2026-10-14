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
      backgroundColor: colors.paper,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarLabelStyle: { fontFamily, fontSize: 11, marginTop: -2 },
    sceneStyle: { backgroundColor: colors.paper },
  };
}
