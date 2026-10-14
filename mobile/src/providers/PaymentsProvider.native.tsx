import { StripeProvider } from '@stripe/stripe-react-native';
import type { ReactElement } from 'react';

import { STRIPE_PUBLISHABLE_KEY } from '@/config/app';

/** Gives the app access to Stripe's payment sheet. Without a key the app still works; paying just fails gracefully. */
export function PaymentsProvider({ children }: { children: ReactElement }) {
  if (!STRIPE_PUBLISHABLE_KEY) return <>{children}</>;
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.nouri.app" urlScheme="nouri">
      {children}
    </StripeProvider>
  );
}
