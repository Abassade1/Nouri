// Nouri Plus membership (a Stripe subscription).
// Body: { action: 'info' }      -> { price: { amount_cents, currency, interval } }
//       { action: 'checkout' }  -> { url }  Stripe Checkout page to subscribe
//       { action: 'portal' }    -> { url }  Stripe billing portal to update or cancel
// Needs STRIPE_PLUS_PRICE_ID (a recurring price) and PLUS_RETURN_URL (an https page that
// forwards to nouri://plus; the admin site serves one at /plus-return).
// The `subscriptions` table is updated by stripe-webhook, never here.
import { requireUser, serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new HttpError(500, `missing_env_${k}`);
  return v;
};

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const { action } = await req.json().catch(() => ({ action: null }));
  const stripe = stripeClient();

  if (action === 'info') {
    const price = await stripe.prices.retrieve(env('STRIPE_PLUS_PRICE_ID'));
    return json({ price: { amount_cents: price.unit_amount, currency: price.currency.toUpperCase(), interval: price.recurring?.interval ?? 'month' } });
  }

  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner') throw new HttpError(403, 'owners_only');

  // One Stripe customer per person, shared with booking payments.
  const svc = serviceClient();
  const { data: existing } = await svc.from('stripe_customers').select('customer_id').eq('user_id', user.id).maybeSingle();
  let customerId: string | undefined = existing?.customer_id;

  if (action === 'portal') {
    if (!customerId) throw new HttpError(404, 'no_subscription');
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: env('PLUS_RETURN_URL') });
    return json({ url: portal.url });
  }

  if (action === 'checkout') {
    const { data: sub } = await svc.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle();
    if (sub && ['active', 'trialing', 'past_due'].includes(sub.status)) throw new HttpError(409, 'already_subscribed');
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customerId = customer.id;
      await svc.from('stripe_customers').insert({ user_id: user.id, customer_id: customerId });
    }
    const returnUrl = env('PLUS_RETURN_URL');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: env('STRIPE_PLUS_PRICE_ID'), quantity: 1 }],
      // The webhook reads this to know whose membership it is.
      subscription_data: { metadata: { user_id: user.id, product: 'nouri_plus' } },
      client_reference_id: user.id,
      success_url: `${returnUrl}?status=success`,
      cancel_url: `${returnUrl}?status=cancelled`,
    });
    if (!session.url) throw new HttpError(502, 'checkout_unavailable');
    return json({ url: session.url });
  }

  throw new HttpError(400, 'unknown_action');
});
