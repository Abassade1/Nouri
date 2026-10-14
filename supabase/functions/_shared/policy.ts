/**
 * Money rules, as plain functions with no network or database access, so they can be unit-tested
 * and read by a non-engineer. Everything amount-related is integer cents.
 *
 * The app shows owners a refund estimate using the same rule (mobile/src/lib/refunds.ts); a test
 * checks the two stay identical.
 */

export type CityMoney = {
  cancellation_full_refund_hours: number;
  cancellation_late_refund_pct: number;
  payout_hold_hours: number;
};

export type Actor = 'owner' | 'carer' | 'admin';

/** Share of the booking total (0-100) that is refunded when a PAID booking is cancelled. */
export function refundPercent(opts: { actor: Actor; startAt: Date; now: Date; city: CityMoney }): number {
  const { actor, startAt, now, city } = opts;
  // A carer (or admin) cancelling is never the owner's fault.
  if (actor !== 'owner') return 100;
  const hoursUntil = (startAt.getTime() - now.getTime()) / 3_600_000;
  return hoursUntil >= city.cancellation_full_refund_hours ? 100 : city.cancellation_late_refund_pct;
}

export const refundCents = (totalCents: number, pct: number) => Math.round((totalCents * pct) / 100);

/** When a completed visit's payout may be transferred to the carer. */
export function payoutReleaseAt(completedAt: Date, city: CityMoney): Date {
  return new Date(completedAt.getTime() + city.payout_hold_hours * 3_600_000);
}

export type ReleasableBooking = {
  status: string;
  completed_at: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  carer_payout_cents: number;
};

/** A payout is released only for paid, completed (not disputed/cancelled) visits, once, after the hold. */
export function isReleaseDue(b: ReleasableBooking, city: CityMoney, now: Date): boolean {
  if (b.status !== 'completed' || !b.completed_at || !b.stripe_charge_id || b.stripe_transfer_id) return false;
  if (b.carer_payout_cents <= 0) return false;
  return payoutReleaseAt(new Date(b.completed_at), city).getTime() <= now.getTime();
}

/** Can this Stripe Express account receive money and pay it out? */
export function accountIsReady(acct: {
  payouts_enabled?: boolean;
  capabilities?: { transfers?: string } | null;
  requirements?: { disabled_reason?: string | null } | null;
}): boolean {
  return !!acct.payouts_enabled && acct.capabilities?.transfers === 'active' && !acct.requirements?.disabled_reason;
}

/** Fields for the platform-side PaymentIntent. The owner pays the full total; nothing goes to the carer yet. */
export function paymentIntentParams(b: { id: string; total_cents: number; currency: string; owner_id: string; carer_id: string }, customerId: string) {
  return {
    amount: b.total_cents,
    currency: b.currency.toLowerCase(),
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    transfer_group: `booking_${b.id}`,
    description: `Booking ${b.id}`,
    metadata: { booking_id: b.id, owner_id: b.owner_id, carer_id: b.carer_id },
  };
}

export type DisputeBooking = {
  status: string;
  total_cents: number;
  refunded_cents: number;
  carer_payout_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
};

/**
 * What it takes to refund the owner in full after a dispute.
 * If the carer was already paid, that transfer is reversed first so the platform isn't left out of pocket.
 * Returns null when it can't be done (not disputed, or nothing was ever paid).
 */
export function disputeRefundPlan(b: DisputeBooking): { reverseTransferCents: number | null; refundCents: number } | null {
  if (b.status !== 'disputed' || !b.stripe_payment_intent_id) return null;
  const refundCents = b.total_cents - b.refunded_cents;
  if (refundCents <= 0) return null;
  return { reverseTransferCents: b.stripe_transfer_id ? b.carer_payout_cents : null, refundCents };
}
