/** Web / default: push notifications only exist in the native app. (Real implementation: push.native.ts.) */
export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPushStatus(): Promise<PushStatus> {
  return 'unsupported';
}
export async function registerForPush(_userId: string, _language: string, _ask = true): Promise<PushStatus> {
  return 'unsupported';
}
export async function unregisterForPush(): Promise<void> {}
export function usePushSetup(_userId: string | null, _language: string) {}
