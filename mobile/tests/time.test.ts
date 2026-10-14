import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimatePrice } from '../src/lib/pricing';
import { addDays, durationMinutes, generateSlots, todayInZone, weekdayOf, zonedTimeToUtc } from '../src/lib/time';

const CAL = 'America/Edmonton';

test('Calgary noon in winter is 19:00 UTC (MST, UTC-7)', () => {
  assert.equal(zonedTimeToUtc('2026-01-15', '12:00', CAL).toISOString(), '2026-01-15T19:00:00.000Z');
});

test('Calgary noon in summer is 18:00 UTC (MDT, UTC-6)', () => {
  assert.equal(zonedTimeToUtc('2026-07-15', '12:00', CAL).toISOString(), '2026-07-15T18:00:00.000Z');
});

test('daylight saving switch day (2026-03-08) still resolves correctly', () => {
  assert.equal(zonedTimeToUtc('2026-03-08', '01:30', CAL).toISOString(), '2026-03-08T08:30:00.000Z'); // before: UTC-7
  assert.equal(zonedTimeToUtc('2026-03-08', '09:00', CAL).toISOString(), '2026-03-08T15:00:00.000Z'); // after: UTC-6
});

test('Toronto and Dubai zones', () => {
  assert.equal(zonedTimeToUtc('2026-01-15', '09:00', 'America/Toronto').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedTimeToUtc('2026-01-15', '09:00', 'Asia/Dubai').toISOString(), '2026-01-15T05:00:00.000Z');
});

test('todayInZone follows the city, not the machine', () => {
  const instant = new Date('2026-01-15T03:00:00Z'); // still Jan 14 evening in Calgary
  assert.equal(todayInZone(CAL, instant), '2026-01-14');
  assert.equal(todayInZone('Asia/Dubai', instant), '2026-01-15');
});

test('date arithmetic and weekdays', () => {
  assert.equal(addDays('2026-02-27', 2), '2026-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-10-12'), 1); // Monday
});

test('slots: a one-hour walk cannot start so late that it overruns the window', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  const slots = generateSlots([{ start_time: '09:00', end_time: '12:00' }], { date: '2026-10-12', tz: CAL, unit: 'per_walk', now });
  assert.deepEqual(slots, ['09:00', '09:30', '10:00', '10:30', '11:00']);
});

test('slots: overnight stays only need to start inside the window', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  const slots = generateSlots([{ start_time: '17:00', end_time: '19:00' }], { date: '2026-10-12', tz: CAL, unit: 'per_night', now });
  assert.deepEqual(slots, ['17:00', '17:30', '18:00', '18:30']);
});

test('slots: respects 2 hours minimum notice (and local time)', () => {
  // 15:00 UTC on Oct 12 is 09:00 in Calgary (MDT). Notice cutoff = 11:00 local.
  const now = new Date('2026-10-12T15:00:00Z');
  const slots = generateSlots([{ start_time: '09:00', end_time: '13:00' }], { date: '2026-10-12', tz: CAL, unit: 'per_visit', now });
  assert.equal(slots[0], '11:00');
});

test('slots: two windows merge and de-duplicate', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  const slots = generateSlots(
    [{ start_time: '08:00:00', end_time: '09:00:00' }, { start_time: '08:30', end_time: '10:00' }],
    { date: '2026-10-12', tz: CAL, unit: 'per_visit', now },
  );
  assert.deepEqual(slots, ['08:00', '08:30', '09:00', '09:30']);
});

test('durations', () => {
  assert.equal(durationMinutes('per_walk'), 60);
  assert.equal(durationMinutes('per_night', 3), 3 * 24 * 60);
});

test('price estimate matches the database rounding (GST 5% + PST 7%)', () => {
  const p = estimatePrice(3333, 3, [{ code: 'GST', rate: 0.05 }, { code: 'PST', rate: 0.07 }]);
  assert.equal(p.subtotal, 9999);
  assert.deepEqual(p.taxes.map((t) => t.cents), [500, 700]); // 499.95 -> 500, 699.93 -> 700
  assert.equal(p.total, 11199);
});
