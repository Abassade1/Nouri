import { carerNames, names } from "./ops";
import { financeState, overdueReleases, summarize, type CurrencySummary, type FinanceBooking, type FinanceState } from "./finance-core";
import { PREVIEW } from "./preview";
import { adminPreview } from "./preview-admin";
import { createClient } from "./supabase/server";

export type Range = "d30" | "d90" | "all";
export type PaidRow = FinanceBooking & {
  owner_name: string | null;
  carer_name: string | null;
  service: { name_i18n: Record<string, string> } | null;
  timezone: string;
  start_at: string;
};
export type PaymentsView = {
  rows: (PaidRow & { state: FinanceState })[];
  summaries: CurrencySummary[];
  overdue: PaidRow[];
  failed: number;
  openDisputes: number;
};

const SELECT = `id, status, currency, total_cents, refunded_cents, commission_cents, tax_cents, carer_payout_cents, paid_at, completed_at,
  transferred_at, start_at, owner_id, carer_id, services(name_i18n), cities(timezone, payout_hold_hours)`;

const sinceFor = (range: Range) => (range === "all" ? null : new Date(Date.now() - (range === "d30" ? 30 : 90) * 86400000).toISOString());

export async function getPayments(range: Range): Promise<PaymentsView> {
  let rows: PaidRow[];
  let failed: number;
  let openDisputes: number;

  if (PREVIEW) {
    const since = sinceFor(range);
    rows = adminPreview.payments().filter((r) => !since || (r.paid_at ?? "") >= since);
    failed = adminPreview.failedCount();
    openDisputes = adminPreview.openDisputes();
  } else {
    const supabase = await createClient();
    let q = supabase.from("bookings").select(SELECT).not("paid_at", "is", null);
    const since = sinceFor(range);
    if (since) q = q.gte("paid_at", since);
    const [paid, f, d] = await Promise.all([
      q.order("paid_at", { ascending: false }).limit(5000),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "payment_failed"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "disputed"),
    ]);
    if (paid.error) throw paid.error;
    const data = (paid.data ?? []) as any[];
    const [n, c] = data.length ? await Promise.all([names(data.flatMap((r) => [r.owner_id, r.carer_id])), carerNames(data.map((r) => r.carer_id))]) : [new Map(), new Map()];
    rows = data.map((r) => ({
      id: r.id, status: r.status, currency: r.currency, total_cents: r.total_cents, refunded_cents: r.refunded_cents ?? 0,
      commission_cents: r.commission_cents, tax_cents: r.tax_cents, carer_payout_cents: r.carer_payout_cents, paid_at: r.paid_at,
      completed_at: r.completed_at, transferred_at: r.transferred_at, hold_hours: r.cities?.payout_hold_hours ?? 24,
      owner_name: n.get(r.owner_id) ?? null, carer_name: c.get(r.carer_id) ?? n.get(r.carer_id) ?? null,
      service: r.services, timezone: r.cities?.timezone ?? "UTC", start_at: r.start_at,
    }));
    failed = f.count ?? 0;
    openDisputes = d.count ?? 0;
  }

  return {
    rows: rows.map((r) => ({ ...r, state: financeState(r) })),
    summaries: summarize(rows),
    overdue: overdueReleases(rows, new Date()) as PaidRow[],
    failed,
    openDisputes,
  };
}
