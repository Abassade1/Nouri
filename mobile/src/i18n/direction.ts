import AsyncStorage from '@react-native-async-storage/async-storage';
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

const RESTART_KEY = 'app.directionRestart';

/**
 * Whether to restart for a direction change. A restart is attempted only once per
 * target direction: if the direction still hasn't flipped afterwards (a development
 * reload only reloads JavaScript, not the native setting), we carry on rather than
 * reloading forever. The new direction then applies on the next full launch.
 */
export async function shouldRestartForDirection(language: string): Promise<boolean> {
  const target = isRtlLanguage(language) ? 'rtl' : 'ltr';
  try {
    if ((await AsyncStorage.getItem(RESTART_KEY)) === target) {
      await AsyncStorage.removeItem(RESTART_KEY);
      return false;
    }
    await AsyncStorage.setItem(RESTART_KEY, target);
    return true;
  } catch {
    return false; // can't remember attempts: never risk a loop
  }
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
