import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listWaitlist } from "@/lib/waitlist";

/** The waitlist as CSV (personal data: admin only, never cached). */
export async function GET() {
  await requireAdmin();
  const rows = await listWaitlist();
  const csv = toCsv(
    ["email", "city", "interest", "language", "joined_at", "contacted_at"],
    rows.map((w) => [w.email, w.city_id ? (w.city_name?.en ?? "") : (w.requested_city ?? ""), w.interest, w.language, w.created_at, w.notified_at]),
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="waitlist.csv"', "Cache-Control": "no-store" } });
}
