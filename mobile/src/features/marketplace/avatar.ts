import { supabase } from '@/lib/supabase';

/** Carer profile photos live in the public 'avatars' bucket. */
export function avatarUrl(path: string | null): string | null {
  if (!path || !supabase) return path;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
