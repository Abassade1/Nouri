// Stripe sends owners here (an https address, which Stripe requires) after Nouri Plus
// checkout or the billing portal. We forward them into the mobile app, keeping the outcome.
export function GET(req: Request) {
  const status = new URL(req.url).searchParams.get('status');
  const target = status === 'success' || status === 'cancelled' ? `nouri://plus?status=${status}` : 'nouri://plus';
  return new Response(null, { status: 302, headers: { Location: target } });
}
