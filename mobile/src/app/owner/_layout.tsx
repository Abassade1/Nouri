import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/features/TabIcon';
import { tabScreenOptions } from '@/components/features/tabScreenOptions';
import { useLocale } from '@/providers/LocaleProvider';
import { fontFamilyFor } from '@/theme/fonts';

export default function OwnerTabs() {
  const { t } = useTranslation('nav');
  const { language } = useLocale();
  return (
    <Tabs screenOptions={tabScreenOptions(fontFamilyFor(language, '500'))}>
      <Tabs.Screen name="index" options={{ title: t('owner.home'), tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: t('owner.discover'), tabBarIcon: ({ color }) => <TabIcon name="compass" color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: t('owner.bookings'), tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} /> }} />
      <Tabs.Screen name="pets" options={{ title: t('owner.pets'), tabBarIcon: ({ color }) => <TabIcon name="heart" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: t('owner.account'), tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }} />
      <Tabs.Screen name="concern/[id]" options={{ href: null }} />
    </Tabs>
  );
}
