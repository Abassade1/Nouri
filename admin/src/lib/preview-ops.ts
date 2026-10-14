import type { DisputeDetail, DisputeFilter, DisputeSummary, FlagFilter, FlagSummary } from "./ops";
import { filterFlags, isResolved } from "./ops";

/** Sample disputes and flags for ADMIN_PREVIEW (in memory; resets when the server restarts). */
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const svc = (en: string, fr: string, ar: string) => ({ name_i18n: { en, fr, ar } });

const disputes: DisputeDetail[] = [
  {
    id: "d1", status: "disputed", disputed_at: ago(20), start_at: ago(60), currency: "CAD", total_cents: 3675, carer_payout_cents: 2975, commission_cents: 525, tax_cents: 175,
    paid_at: ago(100), transferred_at: null, cancel_reason: null, owner_id: "o1", carer_id: "c1", owner_name: "Alex Morgan", carer_name: "Priya Singh",
    dispute_reason: "The walk was only 15 minutes, not an hour, and Biscuit came back with a muddy, wet coat. I asked about it and got no reply.",
    dispute_resolution: null, service: svc("Dog walking", "Promenade de chien", "تمشية الكلاب"), timezone: "America/Edmonton", pets: ["Biscuit"],
    reports: [{ id: "r1", created_at: ago(58), summary: "Quick loop around the block; Biscuit was a bit sluggish so we kept it short.", checklist: { fed: false, walked: true, water_refreshed: true }, photo_urls: [] }],
    flags: [],
  },
  {
    id: "d2", status: "disputed", disputed_at: ago(70), start_at: ago(120), currency: "CAD", total_cents: 4725, carer_payout_cents: 3825, commission_cents: 675, tax_cents: 225,
    paid_at: ago(160), transferred_at: ago(30), cancel_reason: null, owner_id: "o2", carer_id: "c2", owner_name: "Dana Whitfield", carer_name: "Casey Morgan, RVT",
    dispute_reason: "No report was sent and my cat's medication wasn't given according to the bowl in the morning.",
    dispute_resolution: null, service: svc("Senior & medical pet care", "Soins pour animaux âgés ou malades", "رعاية الحيوانات المسنّة والمرضى"), timezone: "America/Edmonton", pets: ["Miso"],
    reports: [], flags: [],
  },
  {
    id: "d3", status: "completed", disputed_at: ago(300), start_at: ago(350), currency: "CAD", total_cents: 3675, carer_payout_cents: 2975, commission_cents: 525, tax_cents: 175,
    paid_at: ago(400), transferred_at: ago(200), cancel_reason: null, owner_id: "o3", carer_id: "c1", owner_name: "Chris Lee", carer_name: "Priya Singh",
    dispute_reason: "Arrived 40 minutes late.", dispute_resolution: "Carer messaged the owner beforehand and the owner had agreed to the later time. Payout released.",
    service: svc("Dog walking", "Promenade de chien", "تمشية الكلاب"), timezone: "America/Edmonton", pets: ["Ziggy"], reports: [], flags: [],
  },
];

const flags: FlagSummary[] = [
  { id: "f1", booking_id: "d1", pet_name: "Biscuit", severity: "urgent", category: "health", notes: "Vomited twice after the walk and is reluctant to drink. Otherwise alert.", created_at: ago(5), carer_name: "Priya Singh", owner_name: "Alex Morgan", actions: [], photo_urls: [] },
  { id: "f2", booking_id: "d2", pet_name: "Miso", severity: "concern", category: "behaviour", notes: "Hiding under the bed and not eating since this morning.", created_at: ago(30), carer_name: "Casey Morgan, RVT", owner_name: "Dana Whitfield", actions: [{ id: "a1", action: "acknowledged", created_at: ago(29) }], photo_urls: [] },
  { id: "f3", booking_id: "d3", pet_name: "Ziggy", severity: "info", category: "other", notes: "Gate latch is loose; I secured it with a tie.", created_at: ago(200), carer_name: "Priya Singh", owner_name: "Chris Lee", actions: [{ id: "a2", action: "acknowledged", created_at: ago(190) }, { id: "a3", action: "resolved", created_at: ago(180) }], photo_urls: [] },
  { id: "f4", booking_id: "d1", pet_name: "Biscuit", severity: "urgent", category: "health", notes: "Slight limp on the back left leg.", created_at: ago(60), carer_name: "Priya Singh", owner_name: "Alex Morgan", actions: [{ id: "a4", action: "called_vet", created_at: ago(59) }], photo_urls: [] },
];

const summary = (d: DisputeDetail): DisputeSummary => {
  const { reports: _r, flags: _f, ...rest } = d;
  return rest;
};

export const opsPreview = {
  listDisputes(filter: DisputeFilter) {
    return disputes.filter((d) => (filter === "open" ? d.status === "disputed" : d.dispute_resolution && d.status !== "disputed")).map(summary);
  },
  getDispute(id: string) { return disputes.find((d) => d.id === id) ?? null; },
  sideWithCarer(id: string, note: string) {
    const d = disputes.find((x) => x.id === id);
    if (!d || d.status !== "disputed") return "generic";
    d.status = "completed"; d.dispute_resolution = note;
    return null;
  },
  refundOwner(id: string, note: string) {
    const d = disputes.find((x) => x.id === id);
    if (!d || d.status !== "disputed") return "generic";
    if (!d.paid_at) return "not_paid";
    d.status = "cancelled"; d.cancel_reason = "dispute_refund"; d.dispute_resolution = note;
    return null;
  },
  listFlags(filter: FlagFilter) { return filterFlags([...flags].sort((a, b) => b.created_at.localeCompare(a.created_at)), filter); },
  getFlag(id: string) { return flags.find((f) => f.id === id) ?? null; },
  counts() {
    return { disputes: disputes.filter((d) => d.status === "disputed").length, urgentFlags: flags.filter((f) => !isResolved(f) && f.severity === "urgent").length };
  },
};
