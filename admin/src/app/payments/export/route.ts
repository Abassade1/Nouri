import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getPayments, type Range } from "@/lib/finance";

/** Paid bookings as CSV for the accountant. Admin only. */
export async function GET(request: Request) {
  await requireAdmin();
  const raw = new URL(request.url).searchParams.get("range");
  const range: Range = raw === "d90" || raw === "all" ? raw : "d30";
  const { rows } = await getPayments(range);
  const amt = (c: number) => (c / 100).toFixed(2);
  const csv = toCsv(
    ["paid_at", "booking_id", "service", "owner", "carer", "currency", "total", "tax", "platform_commission", "carer_payout", "refunded", "state", "completed_at", "released_to_carer_at"],
    rows.map((r) => [r.paid_at, r.id, r.service?.name_i18n?.en ?? "", r.owner_name, r.carer_name, r.currency, amt(r.total_cents), amt(r.tax_cents), amt(r.commission_cents), amt(r.carer_payout_cents), amt(r.refunded_cents), r.state, r.completed_at, r.transferred_at]),
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payments-${range}.csv"`, "Cache-Control": "no-store" } });
}
