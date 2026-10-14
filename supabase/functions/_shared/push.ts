import { renderMessage } from './messages.ts';

export type PendingNotification = {
  id: string;
  user_id: string;
  kind: string;
  priority: 'default' | 'high';
  data: Record<string, unknown>;
};
export type DeviceToken = { token: string; language: string | null; platform?: string | null };

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'default' | 'high';
  channelId: 'default' | 'concerns';
};

/**
 * One notification -> one Expo message per device, in that device's language.
 * Concern flags use the high-importance Android channel so they break through quietly-set phones.
 */
export function buildMessages(n: PendingNotification, tokens: DeviceToken[], fallbackLanguage: string | null): ExpoMessage[] {
  const out: ExpoMessage[] = [];
  for (const t of tokens) {
    const msg = renderMessage(n.kind, t.language ?? fallbackLanguage, n.data);
    if (!msg) continue;
    out.push({
      to: t.token,
      title: msg.title,
      body: msg.body,
      data: { ...n.data, kind: n.kind, notification_id: n.id },
      sound: 'default',
      priority: n.priority,
      channelId: n.kind === 'concern_flag' ? 'concerns' : 'default',
    });
  }
  return out;
}

/** Expo reports dead tokens in its immediate tickets; those devices should be forgotten. */
export function deadTokens(messages: ExpoMessage[], tickets: { status: string; details?: { error?: string } }[]): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]) dead.push(messages[i].to);
  });
  return dead;
}

export const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
