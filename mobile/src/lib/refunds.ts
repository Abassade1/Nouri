/**
 * What an owner gets back when a PAID booking is cancelled. The server (cancel-booking function)
 * applies the real refund; this mirrors its rule so the app can show the amount BEFORE confirming.
 * tests/refunds.test.ts checks this stays identical to supabase/functions/_shared/policy.ts.
 */
export type MoneyPolicy = {
  full_refund_hours: number;
  late_refund_pct: number;
  payout_hold_hours: number;
};

export function refundPercent(opts: { actor: 'owner' | 'carer'; startAt: Date; now: Date; policy: MoneyPolicy }): number {
  const { actor, startAt, now, policy } = opts;
  if (actor !== 'owner') return 100;
  const hoursUntil = (startAt.getTime() - now.getTime()) / 3_600_000;
  return hoursUntil >= policy.full_refund_hours ? 100 : policy.late_refund_pct;
}

export const refundCents = (totalCents: number, pct: number) => Math.round((totalCents * pct) / 100);
