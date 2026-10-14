import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accountIsReady, isReleaseDue, paymentIntentParams, payoutReleaseAt, refundCents, refundPercent } from '../_shared/policy.ts';

const city = { cancellation_full_refund_hours: 24, cancellation_late_refund_pct: 50, payout_hold_hours: 24 };
const now = new Date('2026-10-12T12:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

test('owner cancels 48h ahead: full refund', () => {
  assert.equal(refundPercent({ actor: 'owner', startAt: inHours(48), now, city }), 100);
});
test('owner cancels exactly at the cutoff: still full refund', () => {
  assert.equal(refundPercent({ actor: 'owner', startAt: inHours(24), now, city }), 100);
});
test('owner cancels 23h ahead: late refund percentage', () => {
  assert.equal(refundPercent({ actor: 'owner', startAt: inHours(23), now, city }), 50);
});
test('owner cancels after the start: late refund percentage (not negative hours trick)', () => {
  assert.equal(refundPercent({ actor: 'owner', startAt: inHours(-1), now, city }), 50);
});
test('carer or admin cancellations are always fully refunded', () => {
  assert.equal(refundPercent({ actor: 'carer', startAt: inHours(1), now, city }), 100);
  assert.equal(refundPercent({ actor: 'admin', startAt: inHours(1), now, city }), 100);
});
test('refund amounts round to whole cents', () => {
  assert.equal(refundCents(3675, 100), 3675);
  assert.equal(refundCents(3675, 50), 1838); // 1837.5 rounds up
  assert.equal(refundCents(3675, 0), 0);
});

test('payout release waits for the hold period', () => {
  const completed = '2026-10-11T12:00:00Z';
  const b = { status: 'completed', completed_at: completed, stripe_charge_id: 'ch_1', stripe_transfer_id: null, carer_payout_cents: 2975 };
  assert.equal(payoutReleaseAt(new Date(completed), city).toISOString(), '2026-10-12T12:00:00.000Z');
  assert.equal(isReleaseDue(b, city, now), true); // exactly at 24h
  assert.equal(isReleaseDue(b, city, new Date('2026-10-12T11:59:59Z')), false);
});
test('payout is never released twice, or for disputed / unpaid / unfinished bookings', () => {
  const base = { status: 'completed', completed_at: '2026-10-01T00:00:00Z', stripe_charge_id: 'ch_1', stripe_transfer_id: null, carer_payout_cents: 100 };
  assert.equal(isReleaseDue(base, city, now), true);
  assert.equal(isReleaseDue({ ...base, stripe_transfer_id: 'tr_1' }, city, now), false);
  assert.equal(isReleaseDue({ ...base, status: 'disputed' }, city, now), false);
  assert.equal(isReleaseDue({ ...base, status: 'cancelled' }, city, now), false);
  assert.equal(isReleaseDue({ ...base, stripe_charge_id: null }, city, now), false);
  assert.equal(isReleaseDue({ ...base, completed_at: null }, city, now), false);
  assert.equal(isReleaseDue({ ...base, carer_payout_cents: 0 }, city, now), false);
});

test('a carer account is ready only when payouts and transfers are active and nothing disables it', () => {
  assert.equal(accountIsReady({ payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: { disabled_reason: null } }), true);
  assert.equal(accountIsReady({ payouts_enabled: false, capabilities: { transfers: 'active' } }), false);
  assert.equal(accountIsReady({ payouts_enabled: true, capabilities: { transfers: 'pending' } }), false);
  assert.equal(accountIsReady({ payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: { disabled_reason: 'rejected.fraud' } }), false);
  assert.equal(accountIsReady({}), false);
});

test('payment intent charges the full total in the booking currency, linked to the booking', () => {
  const p = paymentIntentParams({ id: 'b1', total_cents: 3675, currency: 'CAD', owner_id: 'o', carer_id: 'c' }, 'cus_1');
  assert.equal(p.amount, 3675);
  assert.equal(p.currency, 'cad');
  assert.equal(p.customer, 'cus_1');
  assert.equal(p.transfer_group, 'booking_b1');
  assert.equal(p.metadata.booking_id, 'b1');
});

import { disputeRefundPlan } from '../_shared/policy.ts';

const disputed = { status: 'disputed', total_cents: 3675, refunded_cents: 0, carer_payout_cents: 2975, stripe_payment_intent_id: 'pi_1', stripe_transfer_id: null as string | null };

test('dispute refund before the carer was paid: refund the full total, nothing to reverse', () => {
  assert.deepEqual(disputeRefundPlan(disputed), { reverseTransferCents: null, refundCents: 3675 });
});
test('dispute refund after the carer was paid: reverse exactly their payout first', () => {
  assert.deepEqual(disputeRefundPlan({ ...disputed, stripe_transfer_id: 'tr_1' }), { reverseTransferCents: 2975, refundCents: 3675 });
});
test('a partly refunded booking only refunds the remainder', () => {
  assert.equal(disputeRefundPlan({ ...disputed, refunded_cents: 1000 })!.refundCents, 2675);
});
test('nothing to refund when not disputed, never paid, or already fully refunded', () => {
  assert.equal(disputeRefundPlan({ ...disputed, status: 'completed' }), null);
  assert.equal(disputeRefundPlan({ ...disputed, stripe_payment_intent_id: null }), null);
  assert.equal(disputeRefundPlan({ ...disputed, refunded_cents: 3675 }), null);
});
