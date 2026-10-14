import type { ReactElement } from 'react';

/** Web: no card sheet, so nothing to set up. (The native version wraps the app in Stripe's provider.) */
export function PaymentsProvider({ children }: { children: ReactElement }) {
  return <>{children}</>;
}
