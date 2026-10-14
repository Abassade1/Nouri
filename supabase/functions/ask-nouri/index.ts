// Ask Nouri: answers a pet owner's question with Claude, using their own pets as context.
// Body: { message, language? }  ->  { reply, quota }
// Needs the ANTHROPIC_API_KEY secret. Free owners get a daily allowance; Nouri Plus is unlimited.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133';

import {
  ASSISTANT_MODEL, MAX_QUESTION_CHARS, SYSTEM_PROMPT, canAsk, petContext, recentHistory,
  type PetForContext, type Quota, type StoredMessage,
} from '../_shared/assistant.ts';
import { requireUser, serviceClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

serve(async (req) => {
  const { user, db } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? '').trim();
  if (!message) throw new HttpError(400, 'empty_message');
  if (message.length > MAX_QUESTION_CHARS) throw new HttpError(400, 'message_too_long');

  const { data: profile } = await db.from('profiles').select('role, preferred_language').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner') throw new HttpError(403, 'owners_only');

  const svc = serviceClient();
  const quotaOf = async (): Promise<Quota> => {
    const { data, error } = await svc.rpc('assistant_quota', { p_user: user.id }).single();
    if (error) throw error;
    return data as Quota;
  };
  if (!canAsk(await quotaOf())) throw new HttpError(429, 'daily_limit_reached');

  // Read as the owner: row security limits this to their own pets.
  const [{ data: pets }, { data: past }] = await Promise.all([
    db.from('pets')
      .select('id, name, species, breed, sex, birth_date, weight_kg, tags, behaviour_notes, feeding_routine, walking_routine, pet_health(allergies), pet_medications(name, is_active)')
      .is('archived_at', null)
      .order('created_at'),
    db.from('assistant_messages').select('role, content').order('created_at', { ascending: false }).limit(40),
  ]);
  const context: PetForContext[] = (pets ?? []).map((p: any) => ({
    ...p,
    allergies: (Array.isArray(p.pet_health) ? p.pet_health[0] : p.pet_health)?.allergies ?? null,
    medications: (p.pet_medications ?? []).filter((m: any) => m.is_active).map((m: any) => m.name),
  }));
  const history = recentHistory([...((past ?? []) as StoredMessage[]).reverse(), { role: 'user', content: message }]);

  // Record the question first, so it counts even if the answer fails part-way.
  const { error: saveQ } = await svc.from('assistant_messages').insert({ owner_id: user.id, role: 'user', content: message });
  if (saveQ) throw saveQ;

  const client = new Anthropic(); // ANTHROPIC_API_KEY
  let response;
  try {
    response = await client.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // On a safety decline, retry on a suitable fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: petContext(context, body.language ?? profile.preferred_language ?? 'en') },
      ],
      messages: history,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'assistant_busy');
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic error', e.status, e.message);
      throw new HttpError(502, 'assistant_unavailable');
    }
    throw e;
  }

  const text = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim();
  if (response.stop_reason === 'refusal' || !text) {
    // Nothing usable came back: say so without storing an empty answer.
    return json({ reply: null, error: 'assistant_declined', quota: await quotaOf() });
  }

  const reply = text.slice(0, 8000);
  const { error: saveA } = await svc.from('assistant_messages').insert({ owner_id: user.id, role: 'assistant', content: reply });
  if (saveA) throw saveA;
  return json({ reply, quota: await quotaOf() });
});
