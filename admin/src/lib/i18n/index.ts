import { cookies } from "next/headers";

import ar from "./ar";
import en, { type Messages } from "./en";
import fr from "./fr";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };
const MESSAGES: Record<Locale, Messages> = { en, fr, ar };
const FORMAT: Record<Locale, string> = { en: "en-CA", fr: "fr-CA", ar: "ar-AE" };

export const isRtl = (l: Locale) => l === "ar";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("lang")?.value;
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : "en";
}

export async function getI18n() {
  const locale = await getLocale();
  const m = MESSAGES[locale];
  return {
    locale,
    m,
    /** Replace {placeholders} in a message. */
    fill: (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""),
    date: (value: string | Date) => new Intl.DateTimeFormat(FORMAT[locale], { dateStyle: "medium" }).format(new Date(value)),
    dateTime: (value: string | Date, timeZone?: string) => new Intl.DateTimeFormat(FORMAT[locale], { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)),
    money: (cents: number, currency: string) => new Intl.NumberFormat(FORMAT[locale], { style: "currency", currency }).format(cents / 100),
    /** Pick the right translation from a database {"en": ..., "fr": ..., "ar": ...} map. */
    pick: (text: Record<string, string> | null | undefined) => (text ? (text[locale] ?? text.en ?? "") : ""),
  };
}
