import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config/app';

import { LargeSecureStore } from './secure-storage';

export const isBackendConfigured = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 10;

/**
 * The single Supabase client for the app. `null` when the .env keys are missing
 * (the app then shows a friendly "not connected" message instead of crashing).
 */
export const supabase = isBackendConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

// Keep the session fresh only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
