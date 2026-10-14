import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function ApplicationLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
