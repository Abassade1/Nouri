import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';

export type PayoutRow = { id: string; amount_cents: number; currency: string; status: 'pending' | 'in_transit' | 'paid' | 'failed'; created_at: string; paid_at: string | null };

/** Bank payouts Stripe has made to the carer (recorded by the webhook). */
export async function listPayouts(carerId: string): Promise<PayoutRow[]> {
  if (!supabase) {
    if (!PREVIEW_MODE) return [];
    const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    return [{ id: 'po1', amount_cents: 7650, currency: 'CAD', status: 'paid', created_at: d(9), paid_at: d(7) }];
  }
  const { data, error } = await supabase.from('payouts').select('id, amount_cents, currency, status, created_at, paid_at').eq('carer_id', carerId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as PayoutRow[];
}
