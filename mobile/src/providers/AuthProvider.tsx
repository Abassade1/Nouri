import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { CONSENT_VERSION, PREVIEW_MODE, type LanguageCode } from '@/config/app';
import { previewProfile } from '@/features/preview/data';
import { unregisterForPush } from '@/features/notifications/push';
import { AppError, toAppError } from '@/lib/errors';
import { isBackendConfigured, supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/db';

WebBrowser.maybeCompleteAuthSession();

export type AuthStatus = 'loading' | 'signedOut' | 'needsRole' | 'ready';

type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  role: Extract<UserRole, 'owner' | 'carer'>;
  language: LanguageCode;
};

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  isPreview: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Resolves `{ needsEmailConfirmation: true }` when the project requires email confirmation. */
  signUpWithEmail: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  chooseRole: (role: Extract<UserRole, 'owner' | 'carer'>) => Promise<void>;
  signOut: () => Promise<void>;
  startPreview: (role: UserRole) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireClient() {
  if (!supabase) throw new AppError('notConfigured');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, avatar_path, preferred_language')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  // Restore the session and keep it in sync.
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        return;
      }
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => void loadProfile(next.user.id), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Email-confirmation and OAuth links land here as sheppered://auth/callback?code=...
  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const handle = async (url: string | null) => {
      if (!url || !url.includes('auth/callback')) return;
      const code = new URL(url).searchParams.get('code');
      if (code) await supabase!.auth.exchangeCodeForSession(code);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => sub.remove();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAppError(error);
  }, []);

  const signUpWithEmail = useCallback(async (input: SignUpInput) => {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback'),
        // Read by the database trigger that creates the profile. Consent is recorded with a
        // version + timestamp so we can prove what the user agreed to (PIPEDA accountability).
        data: {
          role: input.role,
          full_name: input.fullName.trim(),
          preferred_language: input.language,
          consent_version: CONSENT_VERSION,
          consent_at: new Date().toISOString(),
        },
      },
    });
    if (error) throw toAppError(error);
    // Supabase returns a fake user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) throw new AppError('emailTaken');
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signInWithApple = useCallback(async () => {
    const client = requireClient();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new AppError('generic');
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw toAppError(error);
      // Apple only shares the name on the very first sign-in, so save it right away.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (name && data.user) await client.from('profiles').update({ full_name: name }).eq('id', data.user.id);
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AppError('socialCancelled');
      throw toAppError(e);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const client = requireClient();
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw toAppError(error);
    if (Platform.OS === 'web' || !data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new AppError('socialCancelled');
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new AppError('generic');
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) throw toAppError(exchangeError);
  }, []);

  const chooseRole = useCallback(
    async (role: Extract<UserRole, 'owner' | 'carer'>) => {
      const client = requireClient();
      const { error } = await client.rpc('choose_role', { p_role: role });
      if (error) throw toAppError(error);
      if (session) await loadProfile(session.user.id);
    },
    [session, loadProfile],
  );

  const signOut = useCallback(async () => {
    setPreviewRole(null);
    await unregisterForPush().catch(() => {});
    if (supabase) await supabase.auth.signOut();
  }, []);

  const startPreview = useCallback((role: UserRole) => {
    if (PREVIEW_MODE) setPreviewRole(role);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const activeProfile = previewRole ? previewProfile(previewRole) : profile;
    let status: AuthStatus;
    if (previewRole) status = 'ready';
    else if (loading) status = 'loading';
    else if (!session) status = 'signedOut';
    else if (!profile) status = 'loading'; // signed in, profile row still loading
    else if (!profile.role) status = 'needsRole';
    else status = 'ready';

    return {
      status,
      session,
      profile: activeProfile,
      isPreview: previewRole !== null,
      signInWithEmail,
      signUpWithEmail,
      signInWithApple,
      signInWithGoogle,
      chooseRole,
      signOut,
      startPreview,
    };
  }, [
    previewRole, profile, loading, session,
    signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle, chooseRole, signOut, startPreview,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
