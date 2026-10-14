import type { ParseResult } from "./city-form";

export const RATE_UNITS = ["per_visit", "per_walk", "per_night", "per_trip"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];
export const ICONS = ["walk", "home", "moon", "heart", "car", "scissors", "star", "award"] as const;
export const SERVICE_LANGS = ["en", "fr", "ar", "zh"] as const;

export type ServiceInput = {
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  rate_unit: RateUnit;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

/** name_en / desc_en ... fields -> language maps. Languages the form doesn't show are kept; blanked ones are removed. */
function readMap(fd: FormData, prefix: string, existing: Record<string, string>): Record<string, string> {
  const out = { ...existing };
  for (const lang of SERVICE_LANGS) {
    if (!fd.has(`${prefix}_${lang}`)) continue;
    const v = String(fd.get(`${prefix}_${lang}`) ?? "").trim();
    if (v) out[lang] = v;
    else delete out[lang];
  }
  return out;
}

/**
 * Validates the service form. English is the source language, so an English name and description
 * are required; other languages fall back to English in the apps until they're filled in.
 */
export function parseService(fd: FormData, existing?: { name_i18n: Record<string, string>; description_i18n: Record<string, string> }): ParseResult<ServiceInput> {
  const name = readMap(fd, "name", existing?.name_i18n ?? {});
  const description = readMap(fd, "desc", existing?.description_i18n ?? {});
  if (!name.en) return { ok: false, error: "name_required" };
  if (!description.en) return { ok: false, error: "description_required" };
  if (Object.values(name).some((v) => v.length > 80) || Object.values(description).some((v) => v.length > 300)) return { ok: false, error: "text_too_long" };

  const unit = String(fd.get("unit") ?? "");
  if (!(RATE_UNITS as readonly string[]).includes(unit)) return { ok: false, error: "invalid_unit" };

  const orderRaw = String(fd.get("order") ?? "").trim();
  const order = orderRaw === "" ? 0 : Number(orderRaw);
  if (!Number.isInteger(order) || order < 0 || order > 999) return { ok: false, error: "invalid_order" };

  const icon = String(fd.get("icon") ?? "").trim();
  return {
    ok: true,
    value: {
      name_i18n: name, description_i18n: description, rate_unit: unit as RateUnit,
      icon: (ICONS as readonly string[]).includes(icon) ? icon : null, sort_order: order, is_active: fd.get("active") === "on",
    },
  };
}

export function parseSlug(fd: FormData): ParseResult<string> {
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9_]{1,39}$/.test(slug) ? { ok: true, value: slug } : { ok: false, error: "invalid_service_slug" };
}

/** Languages still missing a name or description, so the screen can nudge the admin to finish translations. */
export function missingTranslations(s: { name_i18n: Record<string, string>; description_i18n: Record<string, string> }, langs: readonly string[]): string[] {
  return langs.filter((l) => !s.name_i18n[l] || !s.description_i18n[l]);
}
