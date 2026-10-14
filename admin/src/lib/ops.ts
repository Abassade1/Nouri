import { PREVIEW } from "./preview";
import { opsPreview } from "./preview-ops";
import { createClient } from "./supabase/server";

export type I18nText = Record<string, string>;

export type Party = { id: string; name: string | null };

export type DisputeSummary = {
  id: string;
  status: string;
  disputed_at: string | null;
  dispute_reason: string | null;
  dispute_resolution: string | null;
  start_at: string;
  currency: string;
  total_cents: number;
  carer_payout_cents: number;
  commission_cents: number;
  tax_cents: number;
  paid_at: string | null;
  transferred_at: string | null;
  cancel_reason: string | null;
  owner_id: string;
  carer_id: string;
  owner_name: string | null;
  carer_name: string | null;
  service: { name_i18n: I18nText } | null;
  timezone: string;
  pets: string[];
};

export type ReportView = { id: string; created_at: string; summary: string | null; checklist: Record<string, boolean>; photo_urls: string[] };
export type FlagSummary = {
  id: string;
  booking_id: string;
  pet_name: string;
  severity: "info" | "concern" | "urgent";
  category: "health" | "behaviour" | "other";
  notes: string;
  created_at: string;
  carer_name: string | null;
  owner_name: string | null;
  actions: { id: string; action: string; created_at: string }[];
  photo_urls: string[];
};
export type DisputeDetail = DisputeSummary & { reports: ReportView[]; flags: FlagSummary[] };

export type DisputeFilter = "open" | "resolved";
export type FlagFilter = "attention" | "urgent" | "resolved" | "all";

const BOOKING_SELECT = `id, status, disputed_at, dispute_reason, dispute_resolution, start_at, currency, total_cents, carer_payout_cents,
  commission_cents, tax_cents, paid_at, transferred_at, cancel_reason, owner_id, carer_id,
  services(name_i18n), cities(timezone), booking_pets(pets(name))`;

export async function names(ids: string[]): Promise<Map<string, string | null>> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p: any) => [p.id, p.full_name]));
}

export async function carerNames(ids: string[]): Promise<Map<string, string | null>> {
  const supabase = await createClient();
  const { data } = await supabase.from("carer_profiles").select("user_id, display_name").in("user_id", [...new Set(ids)]);
  return new Map((data ?? []).map((p: any) => [p.user_id, p.display_name]));
}

function toDispute(r: any, n: Map<string, string | null>, c: Map<string, string | null>): DisputeSummary {
  return {
    id: r.id, status: r.status, disputed_at: r.disputed_at, dispute_reason: r.dispute_reason, dispute_resolution: r.dispute_resolution,
    start_at: r.start_at, currency: r.currency, total_cents: r.total_cents, carer_payout_cents: r.carer_payout_cents,
    commission_cents: r.commission_cents, tax_cents: r.tax_cents, paid_at: r.paid_at, transferred_at: r.transferred_at,
    cancel_reason: r.cancel_reason, owner_id: r.owner_id, carer_id: r.carer_id,
    owner_name: n.get(r.owner_id) ?? null, carer_name: c.get(r.carer_id) ?? n.get(r.carer_id) ?? null,
    service: r.services, timezone: r.cities?.timezone ?? "UTC",
    pets: (r.booking_pets ?? []).map((bp: any) => bp.pets?.name).filter(Boolean),
  };
}

export async function listDisputes(filter: DisputeFilter): Promise<DisputeSummary[]> {
  if (PREVIEW) return opsPreview.listDisputes(filter);
  const supabase = await createClient();
  let q = supabase.from("bookings").select(BOOKING_SELECT);
  q = filter === "open" ? q.eq("status", "disputed") : q.not("dispute_resolution", "is", null).neq("status", "disputed");
  const { data, error } = await q.order("disputed_at", { ascending: filter === "open", nullsFirst: false }).limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.flatMap((r: any) => [r.owner_id, r.carer_id]);
  const [n, c] = rows.length ? await Promise.all([names(ids), carerNames(rows.map((r: any) => r.carer_id))]) : [new Map(), new Map()];
  return rows.map((r: any) => toDispute(r, n, c));
}

async function signed(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.storage.from("visit-photos").createSignedUrls(paths, 600);
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}

const FLAG_SELECT = `id, booking_id, severity, category, notes, photo_paths, created_at, carer_id, owner_id,
  pets(name), concern_flag_actions(id, action, created_at)`;

async function toFlags(rows: any[]): Promise<FlagSummary[]> {
  if (!rows.length) return [];
  const n = await names(rows.flatMap((r) => [r.owner_id, r.carer_id]));
  const c = await carerNames(rows.map((r) => r.carer_id));
  return Promise.all(rows.map(async (r) => ({
    id: r.id, booking_id: r.booking_id, pet_name: r.pets?.name ?? "", severity: r.severity, category: r.category, notes: r.notes,
    created_at: r.created_at, carer_name: c.get(r.carer_id) ?? n.get(r.carer_id) ?? null, owner_name: n.get(r.owner_id) ?? null,
    actions: ((r.concern_flag_actions ?? []) as any[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    photo_urls: await signed(r.photo_paths ?? []),
  })));
}

export async function getDispute(id: string): Promise<DisputeDetail | null> {
  if (PREVIEW) return opsPreview.getDispute(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [n, c] = await Promise.all([names([data.owner_id, data.carer_id]), carerNames([data.carer_id])]);
  const [reports, flags] = await Promise.all([
    supabase.from("visit_reports").select("id, created_at, summary, checklist, photo_paths").eq("booking_id", id).order("created_at"),
    supabase.from("concern_flags").select(FLAG_SELECT).eq("booking_id", id).order("created_at"),
  ]);
  return {
    ...toDispute(data, n, c),
    reports: await Promise.all(((reports.data ?? []) as any[]).map(async (r) => ({
      id: r.id, created_at: r.created_at, summary: r.summary, checklist: r.checklist ?? {}, photo_urls: await signed(r.photo_paths ?? []),
    }))),
    flags: await toFlags((flags.data ?? []) as any[]),
  };
}

/** Decide in the carer's favour: the visit stands as completed and the payout is released after the normal hold. */
export async function sideWithCarer(id: string, note: string): Promise<string | null> {
  if (PREVIEW) return opsPreview.sideWithCarer(id, note);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings").update({ status: "completed", dispute_resolution: note }).eq("id", id).eq("status", "disputed").select("id");
  if (error) return "generic";
  return data && data.length ? null : "generic";
}

/** Refund the owner in full. Goes through the server because it moves money at Stripe. */
export async function refundOwner(id: string, note: string): Promise<string | null> {
  if (PREVIEW) return opsPreview.refundOwner(id, note);
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("admin-dispute-refund", { body: { booking_id: id, resolution: note } });
  if (!error) return null;
  try {
    const payload = await (error as { context?: Response }).context?.json();
    if (payload?.error === "not_paid") return "not_paid";
    if (payload?.error === "note_required") return "note_required";
  } catch {
    // fall through
  }
  return "refund_failed";
}

export async function listFlags(filter: FlagFilter): Promise<FlagSummary[]> {
  if (PREVIEW) return opsPreview.listFlags(filter);
  const supabase = await createClient();
  const { data, error } = await supabase.from("concern_flags").select(FLAG_SELECT).order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return filterFlags(await toFlags(data ?? []), filter);
}

export async function getFlag(id: string): Promise<FlagSummary | null> {
  if (PREVIEW) return opsPreview.getFlag(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("concern_flags").select(FLAG_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? (await toFlags([data]))[0] : null;
}

export const isResolved = (f: FlagSummary) => f.actions.some((a) => a.action === "resolved");

export function filterFlags(flags: FlagSummary[], filter: FlagFilter): FlagSummary[] {
  switch (filter) {
    case "attention": return flags.filter((f) => !isResolved(f));
    case "urgent": return flags.filter((f) => !isResolved(f) && f.severity === "urgent");
    case "resolved": return flags.filter(isResolved);
    default: return flags;
  }
}

/** Hours since the flag was raised with NO owner response, or null if the owner has responded. */
export function hoursWithoutResponse(f: FlagSummary, now = new Date()): number | null {
  if (f.actions.length > 0) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(f.created_at).getTime()) / 3_600_000));
}

/** Numbers for the navigation badges. */
export async function opsCounts(): Promise<{ disputes: number; urgentFlags: number }> {
  if (PREVIEW) return opsPreview.counts();
  const supabase = await createClient();
  const [d, f] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "disputed"),
    supabase.from("concern_flags").select("id, severity, concern_flag_actions(action)").eq("severity", "urgent").gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
  ]);
  const urgent = ((f.data ?? []) as any[]).filter((r) => !(r.concern_flag_actions ?? []).some((a: any) => a.action === "resolved")).length;
  return { disputes: d.count ?? 0, urgentFlags: urgent };
}
