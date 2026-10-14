// Carer payout account (Stripe Express): start onboarding, check status, open the Stripe dashboard.
// Body: { action: 'onboard' | 'status' | 'dashboard' }
import { requireUser, serviceClient, stripeClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { accountIsReady } from '../_shared/policy.ts';

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const { action } = await req.json();

  const { data: carer } = await db
    .from('carer_profiles')
    .select('user_id, status, stripe_account_id, cities(country_code)')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!carer || carer.status !== 'approved') throw new HttpError(403, 'not_approved_carer');

  const stripe = stripeClient();
  const svc = serviceClient();
  let accountId: string | null = carer.stripe_account_id;

  if (action === 'onboard') {
    const returnUrl = Deno.env.get('STRIPE_RETURN_URL');
    if (!returnUrl) throw new HttpError(500, 'missing_env_STRIPE_RETURN_URL');
    if (!accountId) {
      const country = (carer as any).cities?.country_code as string | undefined;
      const account = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email ?? undefined,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        metadata: { carer_id: user.id },
      });
      accountId = account.id;
      await svc.from('carer_profiles').update({ stripe_account_id: accountId }).eq('user_id', user.id);
    }
    const link = await stripe.accountLinks.create({ account: accountId, refresh_url: returnUrl, return_url: returnUrl, type: 'account_onboarding' });
    return json({ url: link.url });
  }

  if (action === 'status') {
    if (!accountId) return json({ payouts_enabled: false, started: false });
    const account = await stripe.accounts.retrieve(accountId);
    const ready = accountIsReady(account as any);
    await svc.from('carer_profiles').update({ payouts_enabled: ready }).eq('user_id', user.id);
    return json({ payouts_enabled: ready, started: true, details_submitted: account.details_submitted });
  }

  if (action === 'dashboard') {
    if (!accountId) throw new HttpError(409, 'no_account');
    const link = await stripe.accounts.createLoginLink(accountId);
    return json({ url: link.url });
  }

  throw new HttpError(400, 'unknown_action');
});
