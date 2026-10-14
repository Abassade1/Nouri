import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@23';

import { HttpError } from './http.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new HttpError(500, `missing_env_${k}`);
  return v;
};

export const stripeClient = () => new Stripe(env('STRIPE_SECRET_KEY'), { httpClient: Stripe.createFetchHttpClient() });

/** Full-access client (bypasses row security). Only ever used after the caller has been checked. */
export const serviceClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

/** The signed-in caller: a client that acts with THEIR rights, so row security still applies. */
export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new HttpError(401, 'not_authenticated');
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
  const { data, error } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (error || !data.user) throw new HttpError(401, 'not_authenticated');
  return { user: data.user, db };
}

export { Stripe };
