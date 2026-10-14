import assert from 'node:assert/strict';
import { test } from 'node:test';

import { refundCents as serverCents, refundPercent as serverPercent } from '../../supabase/functions/_shared/policy.ts';
import { summarizeEarnings, releaseState } from '../src/lib/earnings';
import { refundCents, refundPercent } from '../src/lib/refunds';

test('the app\'s refund estimate always equals the server rule', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  for (const full of [0, 12, 24, 72]) for (const late of [0, 25, 50, 100]) for (const hours of [-5, 0, 1, 11.9, 12, 23.99, 24, 25, 100]) for (const actor of ['owner', 'carer'] as const) {
    const startAt = new Date(now.getTime() + hours * 3_600_000);
    const app = refundPercent({ actor, startAt, now, policy: { full_refund_hours: full, late_refund_pct: late, payout_hold_hours: 24 } });
    const server = serverPercent({ actor, startAt, now, city: { cancellation_full_refund_hours: full, cancellation_late_refund_pct: late, payout_hold_hours: 24 } });
    assert.equal(app, server, `full=${full} late=${late} hours=${hours} actor=${actor}`);
  }
  for (const total of [1, 99, 3675, 100001]) for (const pct of [0, 33, 50, 100]) assert.equal(refundCents(total, pct), serverCents(total, pct));
});

const base = { carer_payout_cents: 3000, start_at: '2026-10-05T17:00:00Z', completed_at: null, paid_at: null, transferred_at: null, timezone: 'America/Edmonton' };

test('release states follow the money', () => {
  assert.equal(releaseState({ ...base, status: 'requested' }), 'none');
  assert.equal(releaseState({ ...base, status: 'confirmed', paid_at: 'x' }), 'upcoming');
  assert.equal(releaseState({ ...base, status: 'completed', paid_at: 'x', completed_at: 'y' }), 'pending');
  assert.equal(releaseState({ ...base, status: 'completed', paid_at: 'x', completed_at: 'y', transferred_at: 'z' }), 'released');
  assert.equal(releaseState({ ...base, status: 'cancelled', paid_at: 'x' }), 'none');
  assert.equal(releaseState({ ...base, status: 'disputed', paid_at: 'x', completed_at: 'y' }), 'none');
});

test('earnings summary adds up by state, and "this month" uses the city\'s calendar', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const s = summarizeEarnings([
    { ...base, status: 'completed', paid_at: 'p', completed_at: 'c', transferred_at: 't', start_at: '2026-10-02T17:00:00Z' }, // released, Oct
    { ...base, status: 'completed', paid_at: 'p', completed_at: 'c', start_at: '2026-10-10T17:00:00Z', carer_payout_cents: 2000 }, // pending, Oct
    { ...base, status: 'confirmed', paid_at: 'p', start_at: '2026-10-20T17:00:00Z', carer_payout_cents: 500 }, // upcoming
    { ...base, status: 'completed', paid_at: 'p', completed_at: 'c', transferred_at: 't', start_at: '2026-09-28T17:00:00Z', carer_payout_cents: 700 }, // released, Sept
    { ...base, status: 'cancelled', paid_at: 'p', carer_payout_cents: 9999 },
  ], now);
  assert.equal(s.released, 3700);
  assert.equal(s.pending, 2000);
  assert.equal(s.upcoming, 500);
  assert.equal(s.thisMonth, 5000);
  // 2026-10-01T03:00Z is still Sept 30 evening in Calgary
  const edge = summarizeEarnings([{ ...base, status: 'completed', paid_at: 'p', completed_at: 'c', start_at: '2026-10-01T03:00:00Z' }], now);
  assert.equal(edge.thisMonth, 0);
});
