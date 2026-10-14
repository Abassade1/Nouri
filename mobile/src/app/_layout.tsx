import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { detectInitialLanguage, initI18n } from '@/i18n';
import { applyDirection, restartApp } from '@/i18n/direction';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { LocaleProvider, useLocale } from '@/providers/LocaleProvider';
import { PaymentsProvider } from '@/providers/PaymentsProvider';
import { usePushSetup } from '@/features/notifications/push';
import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const [i18nReady, setI18nReady] = useState(false);

  // Language + reading direction must be settled before the first screen renders.
  useEffect(() => {
    (async () => {
      const language = await detectInitialLanguage();
      await initI18n(language);
      const { restartRequired } = applyDirection(language);
      if (restartRequired) {
        await restartApp(); // first launch on an Arabic device: restart once to flip layout
        return;
      }
      setI18nReady(true);
    })();
  }, []);

  if (!fontsLoaded || !i18nReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <LocaleProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <PaymentsProvider>
              <RootNavigator />
            </PaymentsProvider>
          </AuthProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Each role only ever gets the screens of its own area. The guards decide, not the screens. */
function RootNavigator() {
  const { status, profile, isPreview } = useAuth();
  const { language } = useLocale();
  usePushSetup(status === 'ready' && !isPreview ? (profile?.id ?? null) : null, language);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  const role = profile?.role;
  const ready = status === 'ready';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="waitlist" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsRole'}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
      <Stack.Protected guard={ready && role === 'owner'}>
        <Stack.Screen name="owner" />
      </Stack.Protected>
      <Stack.Protected guard={ready && role === 'carer'}>
        <Stack.Screen name="carer" />
      </Stack.Protected>
      <Stack.Protected guard={ready && role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}
