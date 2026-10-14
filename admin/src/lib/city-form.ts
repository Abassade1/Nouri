/**
 * Validation for the city forms. The database re-checks everything (tax shape, commission range,
 * launch rules); this gives the admin a clear message first. Percentages are typed as percentages
 * (5, 9.975) and stored as fractions (0.05, 0.09975).
 */
export type TaxLine = { code: string; rate: number };
export type CitySettings = {
  commission_rate: number;
  tax_components: TaxLine[];
  cancellation_full_refund_hours: number;
  cancellation_late_refund_pct: number;
  payout_hold_hours: number;
  launch_areas: string[];
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_TAX_ROWS = 4;
export const TAX_ROWS = MAX_TAX_ROWS;

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
};
const toRate = (pct: number) => Math.round((pct / 100) * 1e6) / 1e6;

export function parseCitySettings(fd: FormData): ParseResult<CitySettings> {
  const commission = num(fd.get("commission"));
  if (commission === null || commission < 0 || commission > 50) return { ok: false, error: "invalid_commission" };

  const taxes: TaxLine[] = [];
  for (let i = 0; i < MAX_TAX_ROWS; i++) {
    const code = String(fd.get(`taxCode${i}`) ?? "").trim();
    const raw = String(fd.get(`taxRate${i}`) ?? "").trim();
    if (!code && !raw) continue;
    const pct = num(fd.get(`taxRate${i}`));
    if (!/^[A-Za-z0-9 ._-]{1,12}$/.test(code) || pct === null || pct < 0 || pct > 40) return { ok: false, error: "invalid_tax" };
    taxes.push({ code, rate: toRate(pct) });
  }
  if (new Set(taxes.map((t) => t.code.toUpperCase())).size !== taxes.length) return { ok: false, error: "invalid_tax" };

  const refundHours = num(fd.get("refundHours"));
  const latePct = num(fd.get("latePct"));
  const holdHours = num(fd.get("holdHours"));
  const whole = (n: number | null, max: number) => n !== null && Number.isInteger(n) && n >= 0 && n <= max;
  if (!whole(refundHours, 720) || !whole(latePct, 100) || !whole(holdHours, 720)) return { ok: false, error: "invalid_hours" };

  const areas = [...new Set(String(fd.get("areas") ?? "").split(",").map((a) => a.trim()).filter(Boolean))].slice(0, 30);

  return {
    ok: true,
    value: {
      commission_rate: toRate(commission),
      tax_components: taxes,
      cancellation_full_refund_hours: refundHours!,
      cancellation_late_refund_pct: latePct!,
      payout_hold_hours: holdHours!,
      launch_areas: areas,
    },
  };
}

export type NewCity = {
  slug: string;
  country_code: string;
  region_code: string;
  timezone: string;
  currency: string;
  default_language: string;
  name_i18n: Record<string, string>;
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseNewCity(fd: FormData, languages: string[]): ParseResult<NewCity> {
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  const country = String(fd.get("country") ?? "").trim().toUpperCase();
  const region = String(fd.get("region") ?? "").trim();
  const tz = String(fd.get("timezone") ?? "").trim();
  const currency = String(fd.get("currency") ?? "").trim().toUpperCase();
  const lang = String(fd.get("defaultLanguage") ?? "").trim();
  const names = readNames(fd);
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return { ok: false, error: "invalid_slug" };
  if (!/^[A-Z]{2}$/.test(country) || !region || !/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "invalid_city" };
  if (!isValidTimeZone(tz)) return { ok: false, error: "invalid_timezone" };
  if (!languages.includes(lang)) return { ok: false, error: "invalid_city" };
  if (!names.en) return { ok: false, error: "name_required" };
  return { ok: true, value: { slug, country_code: country, region_code: region, timezone: tz, currency, default_language: lang, name_i18n: names } };
}

/** name_en / name_fr / name_ar / name_zh fields -> the {en, fr, ar} map stored in the database (blank ones omitted). */
export function readNames(fd: FormData, existing: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...existing };
  for (const lang of ["en", "fr", "ar", "zh"]) {
    const v = String(fd.get(`name_${lang}`) ?? "").trim();
    if (v) out[lang] = v;
    else if (fd.has(`name_${lang}`)) delete out[lang];
  }
  return out;
}
