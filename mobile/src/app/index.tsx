import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/tokens';

/** Entry point: sends each person to the right area for their state and role. */
export default function Index() {
  const { status, profile } = useAuth();

  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (status === 'needsRole') return <Redirect href="/choose-role" />;
  if (status === 'ready') {
    if (profile?.role === 'carer') return <Redirect href="/carer" />;
    if (profile?.role === 'admin') return <Redirect href="/admin" />;
    return <Redirect href="/owner" />;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
