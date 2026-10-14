import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';

import { previewPay } from './api';

export type PayResult = 'paid' | 'cancelled' | 'failed' | 'already_paid' | 'unsupported';

/**
 * Web / default: the card sheet only exists in the native app. In preview mode the payment is
 * simulated so the flow can be reviewed; otherwise web reports "unsupported".
 * (The real implementation is usePayForBooking.native.ts.)
 */
export function usePayForBooking() {
  return async (bookingId: string): Promise<PayResult> => {
    if (PREVIEW_MODE && !supabase) {
      previewPay(bookingId);
      return 'paid';
    }
    return 'unsupported';
  };
}
