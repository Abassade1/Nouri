import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { PREVIEW_MODE } from '@/config/app';
import { callFunction, FunctionError } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export type PlusStatus = {
  active: boolean;
  status: string | null;
  renews_at: string | null;
  cancel_at_period_end: boolean;
};
export type PlusPrice = { amount_cents: number; currency: string; interval: string };

export interface PlusRepo {
  status(userId: string): Promise<PlusStatus>;
  price(): Promise<PlusPrice>;
  /** Opens Stripe Checkout; resolves once the person is back in the app. */
  subscribe(): Promise<void>;
  /** Opens Stripe's billing portal to update a card or cancel. */
  manage(): Promise<void>;
}

const none: PlusStatus = { active: false, status: null, renews_at: null, cancel_at_period_end: false };
const returnUrl = () => Linking.createURL('plus');

const supabaseRepo: PlusRepo = {
  async status(userId) {
    if (!supabase) throw new FunctionError('not_configured');
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return none;
    const end = data.current_period_end as string | null;
    const active = ['active', 'trialing'].includes(data.status) && (!end || new Date(end) > new Date());
    return { active, status: data.status, renews_at: end, cancel_at_period_end: data.cancel_at_period_end };
  },
  async price() {
    const { price } = await callFunction<{ price: PlusPrice }>('nouri-plus', { action: 'info' });
    return price;
  },
  async subscribe() {
    const { url } = await callFunction<{ url: string }>('nouri-plus', { action: 'checkout' });
    await WebBrowser.openAuthSessionAsync(url, returnUrl());
  },
  async manage() {
    const { url } = await callFunction<{ url: string }>('nouri-plus', { action: 'portal' });
    await WebBrowser.openAuthSessionAsync(url, returnUrl());
  },
};

// Preview: membership is simulated in memory; no Stripe.
let previewActive = false;
const previewRepo: PlusRepo = {
  async status() {
    if (!previewActive) return none;
    const renews = new Date(Date.now() + 30 * 86400000).toISOString();
    return { active: true, status: 'active', renews_at: renews, cancel_at_period_end: false };
  },
  async price() { return { amount_cents: 1499, currency: 'CAD', interval: 'month' }; },
  async subscribe() { previewActive = true; },
  async manage() { previewActive = false; },
};

export const plusRepo: PlusRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
