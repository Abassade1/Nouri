import * as Updates from 'expo-updates';
import { DevSettings, I18nManager, Platform } from 'react-native';

import { RTL_LANGUAGES } from '@/config/app';

export const isRtlLanguage = (language: string) => RTL_LANGUAGES.includes(language);

/**
 * Reading direction is a native-level setting on iOS/Android: it only takes
 * effect after the app restarts. This tells the OS what we want and reports
 * whether a restart is needed. On web it simply flips <html dir>.
 */
export function applyDirection(language: string): { restartRequired: boolean } {
  const wantRtl = isRtlLanguage(language);

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = wantRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
    return { restartRequired: false };
  }

  I18nManager.allowRTL(wantRtl);
  I18nManager.swapLeftAndRightInRTL(true);
  if (I18nManager.isRTL !== wantRtl) {
    I18nManager.forceRTL(wantRtl);
    return { restartRequired: true };
  }
  return { restartRequired: false };
}

/** Restart the JS bundle so the new direction is picked up. */
export async function restartApp(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.reload();
    return;
  }
  try {
    if (__DEV__) {
      DevSettings.reload();
    } else {
      await Updates.reloadAsync();
    }
  } catch {
    DevSettings.reload();
  }
}
