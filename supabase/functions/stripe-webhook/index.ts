// Receives Stripe events (payments, refunds, carer accounts, bank payouts).
// Create TWO endpoints in the Stripe dashboard pointing here:
//   1) "Your account" events         -> secret in STRIPE_WEBHOOK_SECRET
//   2) "Connected accounts" events   -> secret in STRIPE_CONNECT_WEBHOOK_SECRET
import { serviceClient, stripeClient } from '../_shared/clients.ts';
import { corsHeaders, HttpError } from '../_shared/http.ts';
import { handleStripeEvent, type WebhookDb } from '../_shared/webhook.ts';

function dbPort(): WebhookDb {
  const svc = serviceClient();
  const bookingCols = 'id, status, total_cents, currency, stripe_payment_intent_id';
  return {
    async recordEvent(id, type) {
      const { error } = await svc.from('stripe_events').insert({ id, type });
      if (error?.code === '23505') return false; // already processed
      if (error) throw error;
      return true;
    },
    async getBooking(id) {
      const { data } = await svc.from('bookings').select(bookingCols).eq('id', id).maybeSingle();
      return data;
    },
    async getBookingByPaymentIntent(pi) {
      const { data } = await svc.from('bookings').select(bookingCols).eq('stripe_payment_intent_id', pi).maybeSingle();
      return data;
    },
    async updateBooking(id, from, patch) {
      let q = svc.from('bookings').update(patch).eq('id', id);
      if (from) q = q.in('status', from);
      const { error } = await q;
      if (error) throw error;
    },
    async setPayoutsEnabled(acct, enabled) {
      const { error } = await svc.from('carer_profiles').update({ payouts_enabled: enabled }).eq('stripe_account_id', acct);
      if (error) throw error;
    },
    async carerIdByAccount(acct) {
      const { data } = await svc.from('carer_profiles').select('user_id').eq('stripe_account_id', acct).maybeSingle();
      return data?.user_id ?? null;
    },
    async upsertPayout(row) {
      const { error } = await svc.from('payouts').upsert(row, { onConflict: 'stripe_payout_id' });
      if (error) throw error;
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });
  const body = await req.text(); // the raw body is required to verify the signature

  const stripe = stripeClient();
  const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')].filter(Boolean) as string[];
  if (secrets.length === 0) throw new HttpError(500, 'missing_webhook_secrets');

  let event = null as Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>> | null;
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) return new Response('invalid signature', { status: 400 });

  try {
    const result = await handleStripeEvent(event as any, dbPort());
    return new Response(JSON.stringify({ received: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('webhook failed', event.id, e);
    // Let Stripe retry: forget that we saw this event.
    await serviceClient().from('stripe_events').delete().eq('id', event.id);
    return new Response('error', { status: 500 });
  }
});
