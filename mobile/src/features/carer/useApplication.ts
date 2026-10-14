import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

import { applicationRepo, type ApplicationData } from './repo';

/** Loads the carer's application and reloads whenever a screen regains focus (after editing a section). */
export function useApplication() {
  const { profile } = useAuth();
  const [data, setData] = useState<ApplicationData | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setData(await applicationRepo.load(profile.id));
      setError(false);
    } catch {
      setError(true);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const status = data ? (data.profile?.status ?? 'none') : null;
  /** Sections are read-only while the application is in review. */
  const locked = status === 'pending' || status === 'suspended';

  return { data, error, refresh, userId: profile?.id ?? '', status, locked };
}
