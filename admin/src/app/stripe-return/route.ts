// Stripe sends carers here (an https address, which Stripe requires) after payout onboarding.
// We immediately forward them into the mobile app.
export function GET() {
  return new Response(null, { status: 302, headers: { Location: 'sheppered://stripe/return' } });
}
