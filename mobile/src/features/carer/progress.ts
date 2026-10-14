import type { ApplicationData } from './repo';

export type SectionKey = 'profile' | 'services' | 'credentials' | 'references' | 'consent';

/** Mirrors the checks the database makes when an application is submitted. */
export function computeProgress(data: ApplicationData): Record<SectionKey, boolean> {
  const p = data.profile;
  return {
    profile: !!(p?.city_id && p.display_name?.trim() && p.bio?.trim() && p.postal_code),
    services: data.services.some((s) => s.is_active),
    credentials: data.credentials.length >= 1,
    references: data.references.length >= 2,
    consent: !!(p?.background_check_consent_at && p.terms_accepted_at),
  };
}

export const isComplete = (progress: Record<SectionKey, boolean>) => Object.values(progress).every(Boolean);

const KNOWN = [
  'application_incomplete_profile', 'application_missing_consent', 'application_needs_credential',
  'application_needs_two_references', 'application_needs_service',
] as const;

/** Turns a database error into a key under application:errors.* (or null if it isn't one of ours). */
export function applicationErrorKey(error: unknown): (typeof KNOWN)[number] | null {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  return KNOWN.find((k) => message.includes(k)) ?? null;
}
