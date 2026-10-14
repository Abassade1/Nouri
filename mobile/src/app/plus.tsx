import { Redirect } from 'expo-router';

/** Stripe returns people to nouri://plus after checkout or the billing portal. */
export default function PlusReturn() {
  return <Redirect href="/owner/plus" />;
}
