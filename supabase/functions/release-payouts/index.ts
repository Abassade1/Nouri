// Scheduled job: pays carers for completed visits once the hold period has passed.
// Call it hourly with the header  x-cron-secret: $CRON_SECRET  (see README for the pg_cron snippet).
import { serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { isReleaseDue } from '../_shared/policy.ts';

serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'unauthorized');

  const svc = serviceClient();
  const stripe = stripeClient();
  const now = new Date();

  const { data: rows, error } = await svc
    .from('bookings')
    .select(`id, status, completed_at, stripe_charge_id, stripe_transfer_id, carer_payout_cents, currency,
             cities(cancellation_full_refund_hours, cancellation_late_refund_pct, payout_hold_hours),
             carer_profiles(stripe_account_id, payouts_enabled)`)
    .eq('status', 'completed')
    .is('stripe_transfer_id', null)
    .not('stripe_charge_id', 'is', null)
    .limit(100);
  if (error) throw error;

  const result = { released: 0, skipped: 0, failed: [] as { id: string; error: string }[] };
  for (const b of (rows ?? []) as any[]) {
    const acct = b.carer_profiles?.stripe_account_id as string | undefined;
    if (!isReleaseDue(b, b.cities, now) || !acct || !b.carer_profiles?.payouts_enabled) {
      result.skipped++;
      continue;
    }
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: b.carer_payout_cents,
          currency: String(b.currency).toLowerCase(),
          destination: acct,
          source_transaction: b.stripe_charge_id, // funds come from this booking's charge only
          transfer_group: `booking_${b.id}`,
          metadata: { booking_id: b.id },
        },
        { idempotencyKey: `transfer-${b.id}` }, // never pay a booking twice
      );
      await svc.from('bookings').update({ stripe_transfer_id: transfer.id, transferred_at: now.toISOString() }).eq('id', b.id);
      result.released++;
    } catch (e) {
      result.failed.push({ id: b.id, error: e instanceof Error ? e.message : 'unknown' });
    }
  }
  return json(result);
});
