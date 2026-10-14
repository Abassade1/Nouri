import type { CitySettings, NewCity } from "./city-form";
import { names } from "./ops";
import { PREVIEW } from "./preview";
import { adminPreview } from "./preview-admin";
import { createClient } from "./supabase/server";

export type CityRow = {
  id: string;
  slug: string;
  country_code: string;
  region_code: string;
  name_i18n: Record<string, string>;
  timezone: string;
  currency: string;
  default_language: string;
  is_active: boolean;
  launched_at: string | null;
  tax_components: { code: string; rate: number }[];
  commission_rate: number;
  cancellation_full_refund_hours: number;
  cancellation_late_refund_pct: number;
  payout_hold_hours: number;
  launch_areas: string[];
};
export type CityListItem = CityRow & { services: number };
export type AuditItem = { id: string; created_at: string; admin_name: string | null; action: string; entity: string; city_id: string; summary: string };
export type CityDetail = CityRow & {
  services_enabled: number;
  open_bookings: number;
  services: { id: string; slug: string; name_i18n: Record<string, string>; enabled: boolean }[];
  audit: AuditItem[];
};

const COLS = `id, slug, country_code, region_code, name_i18n, timezone, currency, default_language, is_active, launched_at, tax_components,
  commission_rate, cancellation_full_refund_hours, cancellation_late_refund_pct, payout_hold_hours, launch_areas`;

export async function listCities(): Promise<CityListItem[]> {
  if (PREVIEW) return adminPreview.cities() as CityListItem[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select(`${COLS}, city_services(is_enabled)`).order("is_active", { ascending: false }).order("slug");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ ...c, commission_rate: Number(c.commission_rate), services: (c.city_services ?? []).filter((s: any) => s.is_enabled).length }));
}

export async function languagesEnabled(): Promise<string[]> {
  if (PREVIEW) return ["en", "fr", "ar", "zh"];
  const supabase = await createClient();
  const { data } = await supabase.from("languages").select("code").eq("is_enabled", true);
  return (data ?? []).map((l: any) => l.code);
}

/** Which settings changed, for the history line (the values themselves are in the audit table). */
function describe(before: any, after: any): string {
  if (!before || !after) return "";
  const skip = new Set(["updated_at", "created_at"]);
  return Object.keys(after).filter((k) => !skip.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])).join(", ");
}

export async function getCity(id: string): Promise<CityDetail | null> {
  if (PREVIEW) return adminPreview.city(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [services, enabled, audit, open] = await Promise.all([
    supabase.from("services").select("id, slug, name_i18n, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("city_services").select("service_id, is_enabled").eq("city_id", id),
    supabase.from("admin_audit_log").select("id, created_at, admin_id, action, entity, city_id, before, after").eq("city_id", id).order("created_at", { ascending: false }).limit(15),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("city_id", id).in("status", ["requested", "accepted", "payment_failed", "confirmed", "in_progress"]),
  ]);
  const on = new Set((enabled.data ?? []).filter((e: any) => e.is_enabled).map((e: any) => e.service_id));
  const adminIds = (audit.data ?? []).map((a: any) => a.admin_id).filter(Boolean);
  const n = adminIds.length ? await names(adminIds) : new Map();
  return {
    ...(data as any), commission_rate: Number(data.commission_rate), services_enabled: on.size, open_bookings: open.count ?? 0,
    services: (services.data ?? []).map((s: any) => ({ id: s.id, slug: s.slug, name_i18n: s.name_i18n, enabled: on.has(s.id) })),
    audit: (audit.data ?? []).map((a: any) => ({
      id: a.id, created_at: a.created_at, admin_name: a.admin_id ? n.get(a.admin_id) ?? null : null, action: a.action, entity: a.entity, city_id: a.city_id,
      summary: a.entity === "city" ? describe(a.before, a.after) : String((a.after ?? a.before)?.service_id ?? ""),
    })),
  };
}

const ERRORS: Record<string, string> = { city_needs_service: "city_needs_service", "23505": "slug_taken", "23514": "invalid_tax", "23503": "invalid_city" };
const mapError = (e: { message?: string; code?: string } | null) => (e ? Object.entries(ERRORS).find(([k]) => e.message?.includes(k) || e.code === k)?.[1] ?? "generic" : null);

/** Saves a city's settings, names, live switch and service list. Services are written first so the "needs a service" rule sees them. */
export async function saveCity(id: string, s: CitySettings, nameMap: Record<string, string>, live: boolean, enabledServiceIds: string[], allServiceIds: string[]): Promise<string | null> {
  if (PREVIEW) return adminPreview.saveCity(id, s, nameMap, live, enabledServiceIds);
  const supabase = await createClient();
  const rows = allServiceIds.map((service_id) => ({ city_id: id, service_id, is_enabled: enabledServiceIds.includes(service_id) }));
  const a = await supabase.from("city_services").upsert(rows, { onConflict: "city_id,service_id" });
  if (a.error) return mapError(a.error);
  const b = await supabase.from("cities").update({ ...s, name_i18n: nameMap, is_active: live }).eq("id", id);
  return mapError(b.error);
}

export async function createCity(n: NewCity): Promise<{ id?: string; error?: string }> {
  if (PREVIEW) return adminPreview.createCity(n);
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").insert({ ...n, is_active: false }).select("id").single();
  return error ? { error: mapError(error) ?? "generic" } : { id: data.id };
}
