import { accountIsReady } from './policy.ts';

/** The slice of a Stripe event we use. */
export type StripeEventLike = {
  id: string;
  type: string;
  account?: string; // set for events on connected (carer) accounts
  data: { object: Record<string, any> };
};

export type BookingRow = {
  id: string;
  status: string;
  total_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
};

/** Everything the webhook needs from the database, as a small interface so it can be tested with a fake. */
export interface WebhookDb {
  /** Returns false if this event id was already processed. */
  recordEvent(id: string, type: string): Promise<boolean>;
  getBooking(id: string): Promise<BookingRow | null>;
  getBookingByPaymentIntent(paymentIntentId: string): Promise<BookingRow | null>;
  updateBooking(id: string, onlyFromStatuses: string[] | null, patch: Record<string, unknown>): Promise<void>;
  setPayoutsEnabled(stripeAccountId: string, enabled: boolean): Promise<void>;
  carerIdByAccount(stripeAccountId: string): Promise<string | null>;
  upsertPayout(row: {
    carer_id: string; stripe_payout_id: string; amount_cents: number; currency: string;
    status: 'pending' | 'in_transit' | 'paid' | 'failed'; paid_at: string | null;
  }): Promise<void>;
  userIdByCustomer(stripeCustomerId: string): Promise<string | null>;
  upsertSubscription(row: {
    user_id: string; stripe_subscription_id: string; status: string;
    current_period_end: string | null; cancel_at_period_end: boolean;
  }): Promise<void>;
}

export type HandleResult = 'duplicate' | 'ignored' | 'confirmed' | 'payment_failed' | 'refund_recorded' | 'account_updated' | 'payout_recorded' | 'amount_mismatch' | 'subscription_updated';

const PAYOUT_STATUS: Record<string, 'pending' | 'in_transit' | 'paid' | 'failed'> = {
  pending: 'pending', in_transit: 'in_transit', paid: 'paid', failed: 'failed', canceled: 'failed',
};

/** Turns one Stripe event into database changes. Safe to call twice with the same event. */
export async function handleStripeEvent(event: StripeEventLike, db: WebhookDb, now: Date = new Date()): Promise<HandleResult> {
  if (!(await db.recordEvent(event.id, event.type))) return 'duplicate';
  const obj = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const bookingId = obj.metadata?.booking_id as string | undefined;
      if (!bookingId) return 'ignored';
      const booking = await db.getBooking(bookingId);
      if (!booking) return 'ignored';
      // Never confirm a booking on an amount we didn't ask for.
      if (obj.amount_received !== booking.total_cents || String(obj.currency).toUpperCase() !== booking.currency.toUpperCase()) {
        return 'amount_mismatch';
      }
      await db.updateBooking(bookingId, ['accepted', 'payment_failed'], {
        status: 'confirmed',
        paid_at: now.toISOString(),
        stripe_payment_intent_id: obj.id,
        stripe_charge_id: typeof obj.latest_charge === 'string' ? obj.latest_charge : obj.latest_charge?.id ?? null,
      });
      return 'confirmed';
    }

    case 'payment_intent.payment_failed': {
      const bookingId = obj.metadata?.booking_id as string | undefined;
      if (!bookingId) return 'ignored';
      await db.updateBooking(bookingId, ['accepted'], { status: 'payment_failed' });
      return 'payment_failed';
    }

    case 'charge.refunded': {
      const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id;
      if (!pi) return 'ignored';
      const booking = await db.getBookingByPaymentIntent(pi);
      if (!booking) return 'ignored';
      await db.updateBooking(booking.id, null, { refunded_cents: obj.amount_refunded });
      return 'refund_recorded';
    }

    case 'account.updated': {
      await db.setPayoutsEnabled(obj.id, accountIsReady(obj));
      return 'account_updated';
    }

    case 'payout.created':
    case 'payout.updated':
    case 'payout.paid':
    case 'payout.failed':
    case 'payout.canceled': {
      if (!event.account) return 'ignored';
      const carerId = await db.carerIdByAccount(event.account);
      if (!carerId || !(obj.amount > 0)) return 'ignored';
      const status = PAYOUT_STATUS[obj.status] ?? 'pending';
      await db.upsertPayout({
        carer_id: carerId,
        stripe_payout_id: obj.id,
        amount_cents: obj.amount,
        currency: String(obj.currency).toUpperCase(),
        status,
        paid_at: status === 'paid' && obj.arrival_date ? new Date(obj.arrival_date * 1000).toISOString() : null,
      });
      return 'payout_recorded';
    }

    // Nouri Plus. Deleted subscriptions arrive with status 'canceled', which ends membership.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      if (event.account) return 'ignored'; // only the platform sells memberships
      const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      const userId = (obj.metadata?.user_id as string | undefined) ?? (customer ? await db.userIdByCustomer(customer) : null);
      if (!userId) return 'ignored';
      // Newer Stripe API versions report the period end per subscription item.
      const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end ?? null;
      await db.upsertSubscription({
        user_id: userId,
        stripe_subscription_id: obj.id,
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : String(obj.status),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: !!obj.cancel_at_period_end,
      });
      return 'subscription_updated';
    }

    default:
      return 'ignored';
  }
}
