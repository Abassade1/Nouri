import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGES, renderMessage } from '../_shared/messages.ts';
import { buildMessages, chunk, deadTokens } from '../_shared/push.ts';

test('every notification kind is written in all four languages, with matching placeholders', () => {
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const [kind, set] of Object.entries(MESSAGES)) {
    for (const lang of ['en', 'fr', 'ar', 'zh'] as const) {
      assert.ok(set[lang]?.title && set[lang]?.body, `${kind}/${lang} missing`);
      assert.equal(ph(set[lang].body), ph(set.en.body), `${kind}/${lang} placeholders differ`);
      assert.equal(ph(set[lang].title), ph(set.en.title), `${kind}/${lang} title placeholders differ`);
    }
  }
});

test('messages are rendered in the device language, falling back to English', () => {
  assert.match(renderMessage('visit_report', 'fr', {})!.title, /Rapport/);
  assert.match(renderMessage('visit_report', 'ar', {})!.title, /تقرير/);
  assert.equal(renderMessage('visit_report', 'de', {})!.title, 'Visit report');
  assert.equal(renderMessage('visit_report', null, {})!.title, 'Visit report');
});

test('placeholders are filled from the notification data', () => {
  assert.match(renderMessage('concern_flag', 'en', { pet_name: 'Biscuit', pet: 'Biscuit' })!.body, /Biscuit/);
  assert.match(renderMessage('review_received', 'en', { rating: 5 })!.body, /5-star/);
});

test('unknown kinds send nothing', () => {
  assert.equal(renderMessage('mystery', 'en', {}), null);
});

test('lock-screen text never contains health details', () => {
  const flag = renderMessage('concern_flag', 'en', { pet: 'Biscuit', notes: 'limping badly', severity: 'urgent' })!;
  assert.doesNotMatch(flag.body + flag.title, /limp|urgent|medical|vet/i);
});

test('one message per device, each in its own language; concern flags use the high-priority channel', () => {
  const n = { id: 'n1', user_id: 'u', kind: 'concern_flag', priority: 'high' as const, data: { pet: 'Biscuit', route: '/owner/concern/1' } };
  const msgs = buildMessages(n, [{ token: 'ExponentPushToken[a]', language: 'en' }, { token: 'ExponentPushToken[b]', language: 'fr' }], 'en');
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].title, /concern/);
  assert.match(msgs[1].title, /préoccupation/);
  assert.equal(msgs[0].channelId, 'concerns');
  assert.equal(msgs[0].priority, 'high');
  assert.equal(msgs[0].data.route, '/owner/concern/1');
  assert.equal(buildMessages({ ...n, kind: 'visit_report', priority: 'default' }, [{ token: 't', language: null }], 'ar')[0].channelId, 'default');
});

test('a device with no stored language uses the profile language', () => {
  const n = { id: 'n', user_id: 'u', kind: 'visit_report', priority: 'default' as const, data: {} };
  assert.match(buildMessages(n, [{ token: 't', language: null }], 'ar')[0].title, /تقرير/);
});

test('unregistered devices are identified so they can be forgotten', () => {
  const n = { id: 'n', user_id: 'u', kind: 'visit_report', priority: 'default' as const, data: {} };
  const msgs = buildMessages(n, [{ token: 'a', language: 'en' }, { token: 'b', language: 'en' }], 'en');
  assert.deepEqual(deadTokens(msgs, [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }]), ['b']);
  assert.deepEqual(deadTokens(msgs, [{ status: 'error', details: { error: 'MessageRateExceeded' } }, { status: 'ok' }]), []);
});

test('batches never exceed Expo\'s limit', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(chunk(Array.from({ length: 250 }, (_, i) => i), 100).length, 3);
});
