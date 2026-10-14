// Owner confirms an ACCEPTED booking and pays. Returns what the mobile PaymentSheet needs.
// Body: { booking_id }
// The charge goes to the platform for the booking total; the carer is paid later (release-payouts).
import { requireUser, serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { paymentIntentParams } from '../_shared/policy.ts';

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const { booking_id } = await req.json();

  // Read as the user: row security guarantees they can only see their own bookings.
  const { data: b } = await db
    .from('bookings')
    .select('id, status, owner_id, carer_id, start_at, total_cents, currency, stripe_payment_intent_id')
    .eq('id', booking_id)
    .maybeSingle();
  if (!b || b.owner_id !== user.id) throw new HttpError(404, 'booking_not_found');
  if (!['accepted', 'payment_failed'].includes(b.status)) throw new HttpError(409, 'not_payable');
  if (new Date(b.start_at) <= new Date()) throw new HttpError(409, 'start_passed');

  const stripe = stripeClient();
  const svc = serviceClient();

  // One Stripe customer per owner (saved cards live there). Stored server-side only.
  const { data: existing } = await svc.from('stripe_customers').select('customer_id').eq('user_id', user.id).maybeSingle();
  let customerId: string = existing?.customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
    customerId = customer.id;
    await svc.from('stripe_customers').insert({ user_id: user.id, customer_id: customerId });
  }

  // Reuse an unfinished payment for this booking instead of creating duplicates.
  let intent = null as Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>> | null;
  if (b.stripe_payment_intent_id) {
    const prior = await stripe.paymentIntents.retrieve(b.stripe_payment_intent_id);
    if (prior.status === 'succeeded') return json({ already_paid: true });
    const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(prior.status);
    if (reusable && prior.amount === b.total_cents) intent = prior;
  }
  if (!intent) {
    intent = await stripe.paymentIntents.create(paymentIntentParams(b, customerId), {
      idempotencyKey: `pi-${b.id}-${b.stripe_payment_intent_id ?? 'first'}`,
    });
    await svc.from('bookings').update({ stripe_payment_intent_id: intent.id }).eq('id', b.id);
  }

  const session = await stripe.customerSessions.create({
    customer: customerId,
    components: {
      mobile_payment_element: {
        enabled: true,
        features: { payment_method_save: 'enabled', payment_method_redisplay: 'enabled', payment_method_remove: 'enabled' },
      },
    },
  });

  return json({
    paymentIntentClientSecret: intent.client_secret,
    customerId,
    customerSessionClientSecret: session.client_secret,
  });
});
