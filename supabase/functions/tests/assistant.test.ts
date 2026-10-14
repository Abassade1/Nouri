import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SYSTEM_PROMPT, canAsk, petContext, recentHistory, type PetForContext } from '../_shared/assistant.ts';

const pet = (over: Partial<PetForContext> = {}): PetForContext => ({
  name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', sex: 'male', birth_date: '2017-03-01', weight_kg: 31.5,
  tags: ['senior'], behaviour_notes: 'Nervous around skateboards.', feeding_routine: null, walking_routine: null,
  allergies: ['chicken'], medications: ['Joint supplement'], ...over,
});

test('the cached instructions hold nothing per-person or time-dependent', () => {
  assert.doesNotMatch(SYSTEM_PROMPT, /\d{4}-\d{2}-\d{2}/);
  assert.match(SYSTEM_PROMPT, /not a veterinarian/);
  assert.match(SYSTEM_PROMPT, /emergency animal clinic/);
});

test('pet context lists each pet with the facts we know, and the reply language', () => {
  const text = petContext([pet(), pet({ name: 'Thunder', species: 'horse', breed: null, sex: 'unknown', birth_date: null, weight_kg: null, tags: [], allergies: [], medications: [], behaviour_notes: null })], 'fr', new Date('2026-10-13'));
  assert.match(text, /Reply in French/);
  assert.match(text, /- Biscuit \(dog, Golden Retriever, male, 9 years, 31\.5 kg\)/);
  assert.match(text, /Allergies: chicken/);
  assert.match(text, /Current medications \(do not advise on doses\): Joint supplement/);
  assert.match(text, /- Thunder \(horse\)/);
});

test('owners without pets, and unknown languages, still get sensible context', () => {
  const text = petContext([], 'xx');
  assert.match(text, /Reply in English/);
  assert.match(text, /not added any pets/);
});

test('history starts with a question, alternates roles and is capped', () => {
  const msgs = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `m${i}` }));
  const out = recentHistory([{ role: 'assistant', content: 'orphan' }, ...msgs]);
  assert.equal(out[0].role, 'user');
  assert.ok(out.length <= 20);
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i].role, out[i - 1].role);
});

test('a question whose answer failed is merged with the next one', () => {
  const out = recentHistory([{ role: 'user', content: 'first' }, { role: 'user', content: 'second' }]);
  assert.deepEqual(out, [{ role: 'user', content: 'first\n\nsecond' }]);
});

test('the daily allowance stops free owners at the limit; Plus is unlimited', () => {
  assert.equal(canAsk({ used_today: 4, daily_limit: 5, is_plus: false }), true);
  assert.equal(canAsk({ used_today: 5, daily_limit: 5, is_plus: false }), false);
  assert.equal(canAsk({ used_today: 99, daily_limit: null, is_plus: true }), true);
});
