import { PREVIEW_MODE } from '@/config/app';
import { refundCents, refundPercent } from '@/lib/refunds';
import { supabase } from '@/lib/supabase';

import { previewBookings } from '../bookings/previewStore';

export class PaymentsError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const preview = PREVIEW_MODE && !supabase;

/** Calls one of our server functions as the signed-in user and returns its JSON (or a PaymentsError with the code). */
async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new PaymentsError('not_configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code = 'server_error';
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) code = payload.error;
    } catch {
      // network failure or non-JSON body
    }
    throw new PaymentsError(code);
  }
  return data as T;
}

// ---- preview-mode stand-ins (no Stripe, no backend) ---------------------------------------------
export const previewPayout = { started: false, ready: false };

// ---- carer payout account -----------------------------------------------------------------------
export type PayoutAccount = { started: boolean; ready: boolean };

export async function connectOnboard(): Promise<{ url: string | null }> {
  if (preview) {
    previewPayout.started = true;
    previewPayout.ready = true;
    return { url: null };
  }
  return call('stripe-connect', { action: 'onboard' });
}

export async function connectStatus(): Promise<PayoutAccount> {
  if (preview) return { ...previewPayout };
  const r = await call<{ payouts_enabled: boolean; started: boolean }>('stripe-connect', { action: 'status' });
  return { started: r.started, ready: r.payouts_enabled };
}

export async function connectDashboard(): Promise<{ url: string | null }> {
  if (preview) return { url: null };
  return call('stripe-connect', { action: 'dashboard' });
}

// ---- owner payment ------------------------------------------------------------------------------
export type PaymentSession = {
  already_paid?: boolean;
  paymentIntentClientSecret?: string;
  customerId?: string;
  customerSessionClientSecret?: string;
};

export async function createPayment(bookingId: string): Promise<PaymentSession> {
  return call('create-payment', { booking_id: bookingId });
}

/** Simulated "payment" for preview mode only. */
export function previewPay(bookingId: string) {
  previewBookings.setStatus(bookingId, 'confirmed', { paid_at: new Date().toISOString() });
}

// ---- cancellation with refund -------------------------------------------------------------------
export async function cancelBooking(bookingId: string, actor: 'owner' | 'carer'): Promise<{ refunded_cents: number; refund_percent: number }> {
  if (preview) {
    const b = previewBookings.get(bookingId);
    if (!b) throw new PaymentsError('booking_not_found');
    const pct = b.paid_at ? refundPercent({ actor, startAt: new Date(b.start_at), now: new Date(), policy: b.policy }) : 0;
    const cents = b.paid_at ? refundCents(b.total_cents, pct) : 0;
    previewBookings.setStatus(bookingId, 'cancelled', { refunded_cents: cents });
    return { refunded_cents: cents, refund_percent: pct };
  }
  return call('cancel-booking', { booking_id: bookingId });
}
