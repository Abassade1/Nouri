// Cancels a booking and applies the refund rules. The only way to cancel a PAID booking.
// Body: { booking_id, reason? }
import { requireUser, serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { refundCents, refundPercent, type Actor } from '../_shared/policy.ts';

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const { booking_id, reason } = await req.json();

  const { data: b } = await db
    .from('bookings')
    .select(`id, status, owner_id, carer_id, start_at, total_cents, stripe_payment_intent_id, stripe_transfer_id,
             cities(cancellation_full_refund_hours, cancellation_late_refund_pct, payout_hold_hours)`)
    .eq('id', booking_id)
    .maybeSingle();
  if (!b) throw new HttpError(404, 'booking_not_found');

  const actor: Actor | null = b.owner_id === user.id ? 'owner' : b.carer_id === user.id ? 'carer' : null;
  if (!actor) throw new HttpError(403, 'not_a_participant');
  if (!['requested', 'accepted', 'payment_failed', 'confirmed'].includes(b.status)) throw new HttpError(409, 'not_cancellable');
  if (b.stripe_transfer_id) throw new HttpError(409, 'already_paid_out');

  const svc = serviceClient();
  let refunded = 0;
  let pct = 0;

  if (b.status === 'confirmed') {
    const city = (b as any).cities;
    pct = refundPercent({ actor, startAt: new Date(b.start_at), now: new Date(), city });
    refunded = refundCents(b.total_cents, pct);
    if (refunded > 0 && b.stripe_payment_intent_id) {
      await stripeClient().refunds.create(
        { payment_intent: b.stripe_payment_intent_id, amount: refunded, metadata: { booking_id: b.id, actor } },
        { idempotencyKey: `refund-${b.id}` }, // retrying this call can never refund twice
      );
    }
  }

  const { error } = await svc.from('bookings').update({
    status: 'cancelled',
    cancelled_by: user.id,
    cancel_reason: (typeof reason === 'string' && reason.trim()) || `${actor}_cancelled`,
    refunded_cents: refunded,
  }).eq('id', b.id);
  if (error) throw error;

  return json({ refunded_cents: refunded, refund_percent: pct });
});
