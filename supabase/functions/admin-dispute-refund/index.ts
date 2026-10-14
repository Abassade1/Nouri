// Admin only: refund the owner in full for a disputed visit (reversing the carer's payout if it was already sent).
// To decide in the carer's favour no Stripe action is needed; the dashboard just updates the booking.
// Body: { booking_id, resolution }
import { requireUser, serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { disputeRefundPlan } from '../_shared/policy.ts';

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const { booking_id, resolution } = await req.json();

  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') throw new HttpError(403, 'admin_only');
  if (typeof resolution !== 'string' || !resolution.trim()) throw new HttpError(400, 'note_required');

  const svc = serviceClient();
  const { data: b } = await svc
    .from('bookings')
    .select('id, status, total_cents, refunded_cents, carer_payout_cents, stripe_payment_intent_id, stripe_transfer_id')
    .eq('id', booking_id)
    .maybeSingle();
  if (!b) throw new HttpError(404, 'booking_not_found');
  if (b.status !== 'disputed') throw new HttpError(409, 'not_disputed');

  const plan = disputeRefundPlan(b);
  if (!plan) throw new HttpError(409, 'not_paid');

  const stripe = stripeClient();
  if (plan.reverseTransferCents && b.stripe_transfer_id) {
    await stripe.transfers.createReversal(
      b.stripe_transfer_id,
      { amount: plan.reverseTransferCents, metadata: { booking_id: b.id, reason: 'dispute_refund' } },
      { idempotencyKey: `reversal-${b.id}` },
    );
  }
  await stripe.refunds.create(
    { payment_intent: b.stripe_payment_intent_id!, amount: plan.refundCents, metadata: { booking_id: b.id, reason: 'dispute_refund' } },
    { idempotencyKey: `dispute-refund-${b.id}` }, // safe to retry: never refunds twice
  );

  const { error } = await svc.from('bookings').update({
    status: 'cancelled',
    cancelled_by: user.id,
    cancel_reason: 'dispute_refund',
    refunded_cents: b.refunded_cents + plan.refundCents,
    dispute_resolution: resolution.trim(),
  }).eq('id', b.id);
  if (error) throw error;

  return json({ refunded_cents: plan.refundCents, reversed_transfer: !!plan.reverseTransferCents });
});
