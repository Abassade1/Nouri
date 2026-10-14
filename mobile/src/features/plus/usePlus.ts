import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

import { plusRepo, type PlusStatus } from './repo';

/** The signed-in person's Nouri Plus membership, refreshed whenever the screen comes into view. */
export function usePlus() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setStatus(await plusRepo.status(profile.id));
    } catch {
      setStatus({ active: false, status: null, renews_at: null, cancel_at_period_end: false });
    }
  }, [profile]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { status, refresh };
}
