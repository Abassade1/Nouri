// Sends queued notifications as push messages (Expo Push Service), in each device's language.
// Trigger it two ways (see README): a Database Webhook on INSERT into `notifications`
// for instant delivery, and a once-a-minute cron as a safety net. Protected by CRON_SECRET.
import { serviceClient } from '../_shared/clients.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { buildMessages, chunk, deadTokens, type PendingNotification } from '../_shared/push.ts';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'unauthorized');

  const svc = serviceClient();
  const { data: rows, error } = await svc
    .from('notifications')
    .select('id, user_id, kind, priority, data')
    .is('sent_at', null)
    .order('created_at')
    .limit(200);
  if (error) throw error;
  const pending = (rows ?? []) as PendingNotification[];
  if (pending.length === 0) return json({ sent: 0, notifications: 0 });

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const [{ data: tokens }, { data: profiles }] = await Promise.all([
    svc.from('push_tokens').select('user_id, token, language, platform').in('user_id', userIds),
    svc.from('profiles').select('id, preferred_language').in('id', userIds),
  ]);
  const langByUser = new Map((profiles ?? []).map((p: any) => [p.id, p.preferred_language as string]));

  const messages = pending.flatMap((n) =>
    buildMessages(n, (tokens ?? []).filter((t: any) => t.user_id === n.user_id), langByUser.get(n.user_id) ?? null));

  let sent = 0;
  const dead: string[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

  for (const batch of chunk(messages, 100)) {
    const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
    if (!res.ok) throw new HttpError(502, 'expo_unavailable'); // leave rows unsent: the next run retries
    const { data: tickets } = await res.json();
    sent += batch.length;
    dead.push(...deadTokens(batch, tickets ?? []));
  }

  if (dead.length) await svc.from('push_tokens').delete().in('token', dead);
  // Mark processed (including users with no device: nothing more we can do for them).
  await svc.from('notifications').update({ sent_at: new Date().toISOString() }).in('id', pending.map((n) => n.id));
  return json({ sent, notifications: pending.length, removed_tokens: dead.length });
});
