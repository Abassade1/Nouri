import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type LanguageCode } from '@/config/app';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';
import { applyDirection, isRtlLanguage, restartApp } from '@/i18n/direction';

type LocaleContextValue = {
  language: LanguageCode;
  isRTL: boolean;
  /** Switch language. Resolves to true if the app must restart to flip direction. */
  setLanguage: (language: LanguageCode) => Promise<{ restartRequired: boolean }>;
  restart: () => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { i18n: instance } = useTranslation();
  const language = instance.language as LanguageCode;
  const [, force] = useState(0);

  const setLanguage = useCallback(async (next: LanguageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // not fatal: the choice just won't persist
    }
    await i18n.changeLanguage(next);
    const result = applyDirection(next);
    force((n) => n + 1);
    return result;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      language,
      // On native the *layout* direction is whatever the OS has applied; on web it follows the language.
      isRTL: Platform.OS === 'web' ? isRtlLanguage(language) : I18nManager.isRTL,
      setLanguage,
      restart: restartApp,
    }),
    [language, setLanguage],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>');
  return ctx;
}
