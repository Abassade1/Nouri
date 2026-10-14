import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { CarerStatus } from '@/types/db';

/** 'none' = the carer hasn't started an application yet. */
export type ApplicationStatus = CarerStatus | 'none';

export function useCarerApplication() {
  const { profile, isPreview } = useAuth();
  const [status, setStatus] = useState<ApplicationStatus | null>(isPreview ? 'none' : null);

  useEffect(() => {
    if (isPreview) {
      setStatus('none');
      return;
    }
    if (!supabase || !profile) return;
    let active = true;
    supabase
      .from('carer_profiles')
      .select('status')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setStatus((data?.status as CarerStatus | undefined) ?? 'none');
      });
    return () => {
      active = false;
    };
  }, [profile, isPreview]);

  return status;
}
