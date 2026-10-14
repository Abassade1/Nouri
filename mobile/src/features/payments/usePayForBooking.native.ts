import { useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';

import { APP_NAME, PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';

import { createPayment, previewPay } from './api';
import type { PayResult } from './usePayForBooking';

/** Opens Stripe's payment sheet for an accepted booking. The server decides the amount; we only show the sheet. */
export function usePayForBooking() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return async (bookingId: string): Promise<PayResult> => {
    if (PREVIEW_MODE && !supabase) {
      previewPay(bookingId);
      return 'paid';
    }
    const session = await createPayment(bookingId);
    if (session.already_paid) return 'already_paid';
    if (!session.paymentIntentClientSecret || !session.customerId || !session.customerSessionClientSecret) return 'failed';

    const init = await initPaymentSheet({
      merchantDisplayName: APP_NAME,
      paymentIntentClientSecret: session.paymentIntentClientSecret,
      customerId: session.customerId,
      customerSessionClientSecret: session.customerSessionClientSecret,
      returnURL: Linking.createURL('stripe-redirect'),
      allowsDelayedPaymentMethods: false,
    });
    if (init.error) return 'failed';

    const { error } = await presentPaymentSheet();
    if (!error) return 'paid';
    return error.code === 'Canceled' ? 'cancelled' : 'failed';
  };
}
