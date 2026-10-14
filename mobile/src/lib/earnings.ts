import { todayInZone } from './time';

export type EarningsBooking = {
  status: string;
  carer_payout_cents: number;
  start_at: string;
  completed_at: string | null;
  paid_at: string | null;
  transferred_at: string | null;
  timezone: string;
};

export type ReleaseState = 'released' | 'pending' | 'upcoming' | 'none';

/** Where a booking's payout is in its life: not yet earned, earned and waiting, or sent to the carer. */
export function releaseState(b: EarningsBooking): ReleaseState {
  if (b.status === 'completed' && b.transferred_at) return 'released';
  if (b.status === 'completed' && b.paid_at) return 'pending';
  if ((b.status === 'confirmed' || b.status === 'in_progress') && b.paid_at) return 'upcoming';
  return 'none';
}

/** Expected release moment for a completed, paid booking (completion + the city's hold). */
export function releaseAt(b: EarningsBooking, holdHours: number): Date | null {
  if (!b.completed_at) return null;
  return new Date(new Date(b.completed_at).getTime() + holdHours * 3_600_000);
}

export function summarizeEarnings(bookings: EarningsBooking[], now: Date = new Date()) {
  let released = 0, pending = 0, upcoming = 0, thisMonth = 0;
  for (const b of bookings) {
    const state = releaseState(b);
    if (state === 'released') released += b.carer_payout_cents;
    if (state === 'pending') pending += b.carer_payout_cents;
    if (state === 'upcoming') upcoming += b.carer_payout_cents;
    if (b.status === 'completed' && b.paid_at) {
      const month = todayInZone(b.timezone, new Date(b.start_at)).slice(0, 7);
      if (month === todayInZone(b.timezone, now).slice(0, 7)) thisMonth += b.carer_payout_cents;
    }
  }
  return { released, pending, upcoming, thisMonth };
}
