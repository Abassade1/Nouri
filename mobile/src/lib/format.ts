import { DEFAULT_LANGUAGE, FORMAT_LOCALES, type LanguageCode } from '@/config/app';

/**
 * Locale-aware formatting. Always pass the current UI language (from useLocale()),
 * and, for money, the currency of the *city* (CAD today, AED/EUR/... later).
 * Money is stored as integer cents everywhere; convert only at display time.
 */
const tag = (language: string) => FORMAT_LOCALES[language as LanguageCode] ?? FORMAT_LOCALES[DEFAULT_LANGUAGE];

export function formatCurrency(cents: number, currency: string, language: string): string {
  return new Intl.NumberFormat(tag(language), { style: 'currency', currency }).format(cents / 100);
}

export function formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(tag(language), options).format(value);
}

export function formatPercent(fraction: number, language: string): string {
  return new Intl.NumberFormat(tag(language), { style: 'percent', maximumFractionDigits: 2 }).format(fraction);
}

export function formatDate(value: Date | string, language: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(language), { dateStyle: 'medium', timeZone }).format(new Date(value));
}

export function formatTime(value: Date | string, language: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(language), { timeStyle: 'short', timeZone }).format(new Date(value));
}

export function formatDateTime(value: Date | string, language: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(language), { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
    new Date(value),
  );
}

/** Picks the right translation from a database {"en": ..., "fr": ..., "ar": ...} map. */
export type I18nText = Partial<Record<string, string>> & { en: string };
export function localized(text: I18nText | null | undefined, language: string): string {
  if (!text) return '';
  return text[language] || text.en || '';
}

/** Format a plain "YYYY-MM-DD" calendar date (no timezone shifting). */
export function formatCalendarDate(date: string, language: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(tag(language), { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/** Name of a weekday (0 = Sunday) in the given language. */
export function weekdayName(weekday: number, language: string, style: 'long' | 'short' = 'long'): string {
  // 2026-10-11 is a Sunday.
  const d = new Date(Date.UTC(2026, 9, 11 + weekday, 12));
  return new Intl.DateTimeFormat(tag(language), { weekday: style, timeZone: 'UTC' }).format(d);
}

/** "HH:MM" -> localised clock time like "9:00 a.m." / "09 h 00" / "9:00 ص". */
export function formatClock(time: string, language: string): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return new Intl.DateTimeFormat(tag(language), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
}
