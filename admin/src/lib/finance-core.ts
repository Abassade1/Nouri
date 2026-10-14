/**
 * Payments overview maths, kept pure so it can be tested. All amounts are integer cents,
 * grouped by currency (a Canadian and a Dubai booking are never added together).
 */
export type FinanceBooking = {
  id: string;
  status: string;
  currency: string;
  total_cents: number;
  refunded_cents: number;
  commission_cents: number;
  tax_cents: number;
  carer_payout_cents: number;
  paid_at: string | null;
  completed_at: string | null;
  transferred_at: string | null;
  hold_hours: number;
};

export type CurrencySummary = {
  currency: string;
  charged: number;       // everything paid by owners
  refunded: number;
  net: number;           // charged - refunded
  commission: number;    // earned on completed, paid, not-cancelled visits
  tax: number;           // tax charged on those visits
  paidOut: number;       // transferred to carers
  owed: number;          // completed-awaiting-release + paid upcoming
  held: number;          // payouts frozen by an open dispute
};

export type FinanceState = "confirmed" | "in_progress" | "awaiting_release" | "released" | "refunded" | "disputed" | "cancelled";

/** Where a paid booking is in its money life. */
export function financeState(b: FinanceBooking): FinanceState {
  if (b.status === "disputed") return "disputed";
  if (b.status === "cancelled") return b.refunded_cents > 0 ? "refunded" : "cancelled";
  if (b.status === "completed") return b.transferred_at ? "released" : "awaiting_release";
  if (b.status === "in_progress") return "in_progress";
  return "confirmed";
}

export function summarize(bookings: FinanceBooking[]): CurrencySummary[] {
  const by = new Map<string, CurrencySummary>();
  for (const b of bookings) {
    if (!b.paid_at) continue; // unpaid requests never moved money
    const s = by.get(b.currency) ?? { currency: b.currency, charged: 0, refunded: 0, net: 0, commission: 0, tax: 0, paidOut: 0, owed: 0, held: 0 };
    by.set(b.currency, s);
    s.charged += b.total_cents;
    s.refunded += b.refunded_cents;
    const state = financeState(b);
    if (state === "awaiting_release" || state === "released") {
      s.commission += b.commission_cents;
      s.tax += b.tax_cents;
    }
    if (state === "released") s.paidOut += b.carer_payout_cents;
    if (state === "awaiting_release" || state === "confirmed" || state === "in_progress") s.owed += b.carer_payout_cents;
    if (state === "disputed") s.held += b.carer_payout_cents;
  }
  for (const s of by.values()) s.net = s.charged - s.refunded;
  return [...by.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Completed, paid visits whose payout should have been released by now but hasn't been. */
export function overdueReleases(bookings: FinanceBooking[], now: Date, graceHours = 6): FinanceBooking[] {
  return bookings.filter((b) =>
    financeState(b) === "awaiting_release" && b.completed_at &&
    new Date(b.completed_at).getTime() + (b.hold_hours + graceHours) * 3_600_000 < now.getTime());
}
