import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/features/TabIcon';
import { tabScreenOptions } from '@/components/features/tabScreenOptions';
import { useLocale } from '@/providers/LocaleProvider';
import { fontFamilyFor } from '@/theme/fonts';

export default function CarerTabs() {
  const { t } = useTranslation('nav');
  const { language } = useLocale();
  return (
    <Tabs screenOptions={tabScreenOptions(fontFamilyFor(language, '500'))}>
      <Tabs.Screen name="index" options={{ title: t('carer.today'), tabBarIcon: ({ color }) => <TabIcon name="sun" color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: t('carer.bookings'), tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: t('carer.earnings'), tabBarIcon: ({ color }) => <TabIcon name="credit-card" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: t('carer.account'), tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }} />
      <Tabs.Screen name="application" options={{ href: null }} />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
    </Tabs>
  );
}
