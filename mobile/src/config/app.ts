/** Working name of the product. Change in one place (and in app.json) when the brand is final. */
export const APP_NAME = 'Sheppered';

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'zh'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Native names, shown in the language picker so people can always find their own language. */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  zh: '中文',
};

export const RTL_LANGUAGES: readonly string[] = ['ar'];

/**
 * Locale tag used for number/date/currency formatting per UI language.
 * Arabic uses Western digits (ar-AE) which is the norm in the Gulf and what most
 * Canadian Arabic speakers expect; change to 'ar-EG' for Arabic-Indic digits.
 */
export const FORMAT_LOCALES: Record<LanguageCode, string> = {
  en: 'en-CA',
  fr: 'fr-CA',
  ar: 'ar-AE',
  zh: 'zh-CN',
};

export const PREVIEW_MODE = process.env.EXPO_PUBLIC_PREVIEW_MODE === 'true';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Bump when the privacy policy / terms text changes; stored with each consent. */
export const CONSENT_VERSION = '2026-10-draft';

/** Stripe publishable key (safe to ship in the app; the secret key lives only on the server). */
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
