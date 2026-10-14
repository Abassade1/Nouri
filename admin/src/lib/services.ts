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
  /** Cover photo in the public 'service-images' bucket; the apps fall back to a bundled photo. */
  image_path?: string | null;
  cities: number;   // cities with it switched on
  carers: number;   // carers currently offering it
};
export type ServiceDetail = ServiceRow & {
  open_bookings: number;
  in_use: boolean; // any carer rate or booking ever: locks the billing unit
  audit: { id: string; created_at: string; admin_name: string | null; action: string; summary: string }[];
};

const COLS = "id, slug, name_i18n, description_i18n, rate_unit, icon, sort_order, is_active, image_path";

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
    sort_order: s.sort_order, is_active: s.is_active, image_path: s.image_path,
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

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const IMAGE_MAX = 5 * 1024 * 1024;

/** Public URL of a service cover image. */
export function serviceImageUrl(path: string | null | undefined): string | null {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}`;
}

/** Uploads a new cover image, points the service at it, then deletes the previous file. */
export async function setServiceImage(id: string, file: File): Promise<string | null> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext || file.size === 0 || file.size > IMAGE_MAX) return "image_invalid";
  if (PREVIEW) return null;
  const supabase = await createClient();
  const { data: before } = await supabase.from("services").select("image_path").eq("id", id).maybeSingle();
  const path = `${id}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("service-images").upload(path, file, { contentType: file.type });
  if (up.error) return "generic";
  const { error } = await supabase.from("services").update({ image_path: path }).eq("id", id);
  if (error) {
    await supabase.storage.from("service-images").remove([path]);
    return mapError(error);
  }
  if (before?.image_path) await supabase.storage.from("service-images").remove([before.image_path]);
  return null;
}

/** Removes the cover image; the apps go back to their bundled photo. */
export async function removeServiceImage(id: string): Promise<string | null> {
  if (PREVIEW) return null;
  const supabase = await createClient();
  const { data: before } = await supabase.from("services").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("services").update({ image_path: null }).eq("id", id);
  if (error) return mapError(error);
  if (before?.image_path) await supabase.storage.from("service-images").remove([before.image_path]);
  return null;
}

export async function createService(slug: string, input: ServiceInput): Promise<{ id?: string; error?: string }> {
  if (PREVIEW) return adminPreview.createService(slug, input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").insert({ slug, ...input }).select("id").single();
  return error ? { error: mapError(error) ?? "generic" } : { id: data.id };
}
