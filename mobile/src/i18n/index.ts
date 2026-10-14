import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { APP_NAME, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/app';

import enAccount from './locales/en/account.json';
import enApplication from './locales/en/application.json';
import enAdmin from './locales/en/admin.json';
import enAuth from './locales/en/auth.json';
import enCarer from './locales/en/carer.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enNav from './locales/en/nav.json';
import enOwner from './locales/en/owner.json';
import enVisits from './locales/en/visits.json';
import enPayments from './locales/en/payments.json';
import enMarketplace from './locales/en/marketplace.json';
import enBookings from './locales/en/bookings.json';
import enPets from './locales/en/pets.json';
import frAccount from './locales/fr/account.json';
import frApplication from './locales/fr/application.json';
import frAdmin from './locales/fr/admin.json';
import frAuth from './locales/fr/auth.json';
import frCarer from './locales/fr/carer.json';
import frCommon from './locales/fr/common.json';
import frErrors from './locales/fr/errors.json';
import frNav from './locales/fr/nav.json';
import frOwner from './locales/fr/owner.json';
import frVisits from './locales/fr/visits.json';
import frPayments from './locales/fr/payments.json';
import frMarketplace from './locales/fr/marketplace.json';
import frBookings from './locales/fr/bookings.json';
import frPets from './locales/fr/pets.json';
import arAccount from './locales/ar/account.json';
import arApplication from './locales/ar/application.json';
import arAdmin from './locales/ar/admin.json';
import arAuth from './locales/ar/auth.json';
import arCarer from './locales/ar/carer.json';
import arCommon from './locales/ar/common.json';
import arErrors from './locales/ar/errors.json';
import arNav from './locales/ar/nav.json';
import arOwner from './locales/ar/owner.json';
import arVisits from './locales/ar/visits.json';
import arPayments from './locales/ar/payments.json';
import arMarketplace from './locales/ar/marketplace.json';
import arBookings from './locales/ar/bookings.json';
import arPets from './locales/ar/pets.json';
import zhAccount from './locales/zh/account.json';
import zhApplication from './locales/zh/application.json';
import zhAdmin from './locales/zh/admin.json';
import zhAuth from './locales/zh/auth.json';
import zhCarer from './locales/zh/carer.json';
import zhCommon from './locales/zh/common.json';
import zhErrors from './locales/zh/errors.json';
import zhNav from './locales/zh/nav.json';
import zhOwner from './locales/zh/owner.json';
import zhVisits from './locales/zh/visits.json';
import zhPayments from './locales/zh/payments.json';
import zhMarketplace from './locales/zh/marketplace.json';
import zhBookings from './locales/zh/bookings.json';
import zhPets from './locales/zh/pets.json';

/**
 * One namespace per feature. English is the source of truth; French and Arabic
 * mirror its keys (checked by `npm run i18n:check`). To add a language, add a
 * folder under locales/, import it here, and add the code to config/app.ts.
 */
export const resources = {
  en: { common: enCommon, auth: enAuth, nav: enNav, owner: enOwner, visits: enVisits, payments: enPayments, marketplace: enMarketplace, bookings: enBookings, pets: enPets, carer: enCarer, admin: enAdmin, account: enAccount, application: enApplication, errors: enErrors },
  fr: { common: frCommon, auth: frAuth, nav: frNav, owner: frOwner, visits: frVisits, payments: frPayments, marketplace: frMarketplace, bookings: frBookings, pets: frPets, carer: frCarer, admin: frAdmin, account: frAccount, application: frApplication, errors: frErrors },
  zh: { common: zhCommon, auth: zhAuth, nav: zhNav, owner: zhOwner, visits: zhVisits, payments: zhPayments, marketplace: zhMarketplace, bookings: zhBookings, pets: zhPets, carer: zhCarer, admin: zhAdmin, account: zhAccount, application: zhApplication, errors: zhErrors },
  ar: { common: arCommon, auth: arAuth, nav: arNav, owner: arOwner, visits: arVisits, payments: arPayments, marketplace: arMarketplace, bookings: arBookings, pets: arPets, carer: arCarer, admin: arAdmin, account: arAccount, application: arApplication, errors: arErrors },
} as const;

export const LANGUAGE_STORAGE_KEY = 'app.language';

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Saved choice first, then the device language, then English. */
export async function detectInitialLanguage(): Promise<LanguageCode> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(saved)) return saved;
  } catch {
    // storage unavailable: fall through to device language
  }
  const device = getLocales()[0]?.languageCode;
  return isSupportedLanguage(device) ? device : DEFAULT_LANGUAGE;
}

export async function initI18n(language: LanguageCode): Promise<void> {
  if (i18n.isInitialized) return;
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false, defaultVariables: { appName: APP_NAME } },
    returnNull: false,
  });
}

export default i18n;
