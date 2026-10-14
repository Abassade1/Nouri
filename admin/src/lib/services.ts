import { names } from "./ops";
import { PREVIEW } from "./preview";
import { adminPreview } from "./preview-admin";
import type { ServiceInput } from "./service-form";
import { createClient } from "./supabase/server";

export type ServiceRow = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  rate_unit: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  cities: number;   // cities with it switched on
  carers: number;   // carers currently offering it
};
export type ServiceDetail = ServiceRow & {
  open_bookings: number;
  in_use: boolean; // any carer rate or booking ever: locks the billing unit
  audit: { id: string; created_at: string; admin_name: string | null; action: string; summary: string }[];
};

const COLS = "id, slug, name_i18n, description_i18n, rate_unit, icon, sort_order, is_active";

export async function listServices(): Promise<ServiceRow[]> {
  if (PREVIEW) return adminPreview.serviceList();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(`${COLS}, city_services(is_enabled), carer_services(is_active)`)
    .order("sort_order")
    .order("slug");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id, slug: s.slug, name_i18n: s.name_i18n, description_i18n: s.description_i18n ?? {}, rate_unit: s.rate_unit, icon: s.icon,
    sort_order: s.sort_order, is_active: s.is_active,
    cities: (s.city_services ?? []).filter((c: any) => c.is_enabled).length,
    carers: (s.carer_services ?? []).filter((c: any) => c.is_active).length,
  }));
}

function changed(before: any, after: any): string {
  if (!before || !after) return "";
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).join(", ");
}

export async function getService(id: string): Promise<ServiceDetail | null> {
  if (PREVIEW) return adminPreview.service(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [cities, carersActive, carersAny, bookingsAny, open, audit] = await Promise.all([
    supabase.from("city_services").select("city_id", { count: "exact", head: true }).eq("service_id", id).eq("is_enabled", true),
    supabase.from("carer_services").select("carer_id", { count: "exact", head: true }).eq("service_id", id).eq("is_active", true),
    supabase.from("carer_services").select("carer_id", { count: "exact", head: true }).eq("service_id", id),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_id", id),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_id", id).in("status", ["requested", "accepted", "payment_failed", "confirmed", "in_progress"]),
    supabase.from("admin_audit_log").select("id, created_at, admin_id, action, before, after").eq("entity", "service").eq("entity_id", id).order("created_at", { ascending: false }).limit(12),
  ]);
  const adminIds = (audit.data ?? []).map((a: any) => a.admin_id).filter(Boolean);
  const n = adminIds.length ? await names(adminIds) : new Map();
  return {
    ...(data as any), description_i18n: data.description_i18n ?? {},
    cities: cities.count ?? 0, carers: carersActive.count ?? 0, open_bookings: open.count ?? 0,
    in_use: (carersAny.count ?? 0) > 0 || (bookingsAny.count ?? 0) > 0,
    audit: (audit.data ?? []).map((a: any) => ({ id: a.id, created_at: a.created_at, admin_name: a.admin_id ? n.get(a.admin_id) ?? null : null, action: a.action, summary: changed(a.before, a.after) })),
  };
}

const mapError = (e: { message?: string; code?: string } | null): string | null => {
  if (!e) return null;
  if (e.message?.includes("rate_unit_locked")) return "rate_unit_locked";
  if (e.code === "23505") return "service_slug_taken";
  if (e.code === "23514") return "name_required";
  return "generic";
};

export async function saveService(id: string, input: ServiceInput): Promise<string | null> {
  if (PREVIEW) return adminPreview.saveService(id, input);
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(input).eq("id", id);
  return mapError(error);
}

export async function createService(slug: string, input: ServiceInput): Promise<{ id?: string; error?: string }> {
  if (PREVIEW) return adminPreview.createService(slug, input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").insert({ slug, ...input }).select("id").single();
  return error ? { error: mapError(error) ?? "generic" } : { id: data.id };
}
