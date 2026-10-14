import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleStripeEvent, type BookingRow, type StripeEventLike, type WebhookDb } from '../_shared/webhook.ts';

function fakeDb(booking: BookingRow | null = { id: 'b1', status: 'accepted', total_cents: 3675, currency: 'CAD', stripe_payment_intent_id: 'pi_1' }) {
  const seen = new Set<string>();
  const log = { updates: [] as { id: string; from: string[] | null; patch: any }[], payoutsEnabled: [] as [string, boolean][], payouts: [] as any[] };
  const db: WebhookDb = {
    async recordEvent(id) { if (seen.has(id)) return false; seen.add(id); return true; },
    async getBooking() { return booking; },
    async getBookingByPaymentIntent() { return booking; },
    async updateBooking(id, from, patch) { log.updates.push({ id, from, patch }); },
    async setPayoutsEnabled(acct, enabled) { log.payoutsEnabled.push([acct, enabled]); },
    async carerIdByAccount(acct) { return acct === 'acct_known' ? 'carer-1' : null; },
    async upsertPayout(row) { log.payouts.push(row); },
  };
  return { db, log };
}

const piSucceeded = (over: Record<string, any> = {}): StripeEventLike => ({
  id: 'evt_1', type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_1', amount_received: 3675, currency: 'cad', latest_charge: 'ch_1', metadata: { booking_id: 'b1' }, ...over } },
});

test('a successful payment confirms the booking and stores the charge', async () => {
  const { db, log } = fakeDb();
  assert.equal(await handleStripeEvent(piSucceeded(), db, new Date('2026-10-12T12:00:00Z')), 'confirmed');
  assert.equal(log.updates.length, 1);
  assert.deepEqual(log.updates[0].from, ['accepted', 'payment_failed']);
  assert.equal(log.updates[0].patch.status, 'confirmed');
  assert.equal(log.updates[0].patch.stripe_charge_id, 'ch_1');
  assert.equal(log.updates[0].patch.paid_at, '2026-10-12T12:00:00.000Z');
});

test('the same event delivered twice is applied once', async () => {
  const { db, log } = fakeDb();
  await handleStripeEvent(piSucceeded(), db);
  assert.equal(await handleStripeEvent(piSucceeded(), db), 'duplicate');
  assert.equal(log.updates.length, 1);
});

test('a payment for the wrong amount or currency never confirms a booking', async () => {
  const wrongAmount = fakeDb();
  assert.equal(await handleStripeEvent(piSucceeded({ amount_received: 100 }), wrongAmount.db), 'amount_mismatch');
  assert.equal(wrongAmount.log.updates.length, 0);
  const wrongCurrency = fakeDb();
  assert.equal(await handleStripeEvent(piSucceeded({ currency: 'usd' }), wrongCurrency.db), 'amount_mismatch');
  assert.equal(wrongCurrency.log.updates.length, 0);
});

test('events for unknown bookings or without metadata are ignored', async () => {
  assert.equal(await handleStripeEvent(piSucceeded(), fakeDb(null).db), 'ignored');
  assert.equal(await handleStripeEvent({ ...piSucceeded({ metadata: {} }), id: 'evt_2' }, fakeDb().db), 'ignored');
});

test('a failed payment moves an accepted booking to payment_failed (and only from accepted)', async () => {
  const { db, log } = fakeDb();
  const ev: StripeEventLike = { id: 'evt_3', type: 'payment_intent.payment_failed', data: { object: { metadata: { booking_id: 'b1' } } } };
  assert.equal(await handleStripeEvent(ev, db), 'payment_failed');
  assert.deepEqual(log.updates[0].from, ['accepted']);
  assert.equal(log.updates[0].patch.status, 'payment_failed');
});

test('refunds are recorded from Stripe, in cents', async () => {
  const { db, log } = fakeDb();
  const ev: StripeEventLike = { id: 'evt_4', type: 'charge.refunded', data: { object: { payment_intent: 'pi_1', amount_refunded: 1838 } } };
  assert.equal(await handleStripeEvent(ev, db), 'refund_recorded');
  assert.equal(log.updates[0].patch.refunded_cents, 1838);
});

test('account.updated turns payouts on only when the account is truly ready', async () => {
  const { db, log } = fakeDb();
  await handleStripeEvent({ id: 'e5', type: 'account.updated', data: { object: { id: 'acct_known', payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: { disabled_reason: null } } } }, db);
  await handleStripeEvent({ id: 'e6', type: 'account.updated', data: { object: { id: 'acct_known', payouts_enabled: true, capabilities: { transfers: 'pending' } } } }, db);
  assert.deepEqual(log.payoutsEnabled, [['acct_known', true], ['acct_known', false]]);
});

test('bank payouts on a carer account are recorded, others ignored', async () => {
  const { db, log } = fakeDb();
  const paid: StripeEventLike = { id: 'e7', type: 'payout.paid', account: 'acct_known', data: { object: { id: 'po_1', amount: 5100, currency: 'cad', status: 'paid', arrival_date: 1790000000 } } };
  assert.equal(await handleStripeEvent(paid, db), 'payout_recorded');
  assert.equal(log.payouts[0].status, 'paid');
  assert.equal(log.payouts[0].currency, 'CAD');
  assert.equal(log.payouts[0].carer_id, 'carer-1');
  assert.ok(log.payouts[0].paid_at);
  assert.equal(await handleStripeEvent({ ...paid, id: 'e8', account: 'acct_stranger' }, db), 'ignored');
  assert.equal(await handleStripeEvent({ ...paid, id: 'e9', account: undefined }, db), 'ignored');
  const failed = await handleStripeEvent({ ...paid, id: 'e10', type: 'payout.failed', data: { object: { ...paid.data.object, id: 'po_2', status: 'failed' } } }, db);
  assert.equal(failed, 'payout_recorded');
  assert.equal(log.payouts[1].status, 'failed');
  assert.equal(log.payouts[1].paid_at, null);
});

test('unrelated event types are ignored', async () => {
  assert.equal(await handleStripeEvent({ id: 'e11', type: 'customer.created', data: { object: {} } }, fakeDb().db), 'ignored');
});
