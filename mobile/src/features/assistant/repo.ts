import { PREVIEW_MODE } from '@/config/app';
import { callFunction, FunctionError } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

import { plusRepo } from '../plus/repo';

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };
export type AssistantQuota = { used_today: number; daily_limit: number | null; is_plus: boolean };

export const FREE_DAILY_QUESTIONS = 5;

export interface AssistantRepo {
  history(): Promise<AssistantMessage[]>;
  quota(): Promise<AssistantQuota>;
  /** Sends a question; resolves the answer (null if Ask Nouri declined) and the updated allowance. */
  ask(message: string, language: string): Promise<{ reply: string | null; quota: AssistantQuota }>;
  clear(): Promise<void>;
}

function db() {
  if (!supabase) throw new FunctionError('not_configured');
  return supabase;
}

const supabaseRepo: AssistantRepo = {
  async history() {
    const { data, error } = await db().from('assistant_messages').select('id, role, content, created_at').order('created_at').limit(100);
    if (error) throw error;
    return (data ?? []) as AssistantMessage[];
  },
  async quota() {
    const { data, error } = await db().rpc('assistant_quota').single();
    if (error) throw error;
    return data as AssistantQuota;
  },
  async ask(message, language) {
    return callFunction('ask-nouri', { message, language });
  },
  async clear() {
    const { error } = await db().from('assistant_messages').delete().not('id', 'is', null);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------------------
// Preview: no AI is called. Replies are fixed samples so the screen can be reviewed offline.
// ---------------------------------------------------------------------------------------
let previewMessages: AssistantMessage[] = [];
let used = 0;
const stamp = () => new Date().toISOString();
const previewQuota = async (): Promise<AssistantQuota> => {
  const plus = (await plusRepo.status('preview')).active;
  return { used_today: used, daily_limit: plus ? null : FREE_DAILY_QUESTIONS, is_plus: plus };
};

const SAMPLE_REPLY =
  "This is a preview, so I'm not connected yet. Once Nouri is live, I'll answer using Biscuit's and Miso's profiles: their routines, allergies and notes. For anything that looks like an emergency, I'll always tell you to call your vet first.";

const previewRepo: AssistantRepo = {
  async history() { return previewMessages; },
  async quota() { return previewQuota(); },
  async ask(message) {
    const q = await previewQuota();
    if (q.daily_limit !== null && used >= q.daily_limit) throw new FunctionError('daily_limit_reached');
    used += 1;
    previewMessages = [
      ...previewMessages,
      { id: `q${used}`, role: 'user', content: message, created_at: stamp() },
      { id: `a${used}`, role: 'assistant', content: SAMPLE_REPLY, created_at: stamp() },
    ];
    await new Promise((r) => setTimeout(r, 700));
    return { reply: SAMPLE_REPLY, quota: await previewQuota() };
  },
  async clear() { previewMessages = []; },
};

export const assistantRepo: AssistantRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
