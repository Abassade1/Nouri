import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import type { PushStatus } from './push';

export type { PushStatus } from './push';

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const ASKED_KEY = 'push.asked';
const projectId = (): string | null => {
  const id = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
  return id && !id.startsWith('REPLACE') ? id : null;
};

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
  // Concern flags get their own loud channel.
  await Notifications.setNotificationChannelAsync('concerns', { name: 'Concerns about your pet', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 300, 200, 300] });
}

export async function getPushStatus(): Promise<PushStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** Asks (if allowed to), then stores this device's push token with the user's language. */
export async function registerForPush(userId: string, language: string, ask = true): Promise<PushStatus> {
  await ensureChannels();
  let status = await getPushStatus();
  if (status !== 'granted' && ask && status === 'undetermined') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status === 'granted' ? 'granted' : 'denied';
  }
  if (status !== 'granted') return status;
  const pid = projectId();
  if (!pid || !supabase) return 'unsupported';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
  await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS, language }, { onConflict: 'token' });
  return 'granted';
}

/** On sign-out, stop sending this person's notifications to this device. */
export async function unregisterForPush(): Promise<void> {
  const pid = projectId();
  if (!pid || !supabase) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // not registered: nothing to remove
  }
}

/** Root-level wiring: register once signed in (asking permission the first time only), keep the language fresh, open the right screen on tap. */
export function usePushSetup(userId: string | null, language: string) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const asked = await AsyncStorage.getItem(ASKED_KEY);
      await registerForPush(userId, language, !asked);
      await AsyncStorage.setItem(ASKED_KEY, '1');
    })().catch(() => {});
  }, [userId, language]);

  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      const route = data?.route;
      if (typeof route === 'string' && route.startsWith('/')) router.push(route as never);
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => open(r?.notification.request.content.data));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [router]);
}
