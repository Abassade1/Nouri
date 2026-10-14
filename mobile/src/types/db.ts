/**
 * Hand-written types for the tables the app touches so far. Once the Supabase CLI
 * is set up, replace with generated types:  supabase gen types typescript > src/types/database.ts
 */
import type { LanguageCode } from '@/config/app';
import type { I18nText } from '@/lib/format';

export type UserRole = 'owner' | 'carer' | 'admin';
export type CarerStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';

export type Profile = {
  id: string;
  role: UserRole | null;
  full_name: string | null;
  phone: string | null;
  avatar_path: string | null;
  preferred_language: LanguageCode;
};

export type TaxComponent = { code: string; rate: number };

export type City = {
  id: string;
  slug: string;
  country_code: string;
  region_code: string;
  name_i18n: I18nText;
  currency: string;
  default_language: LanguageCode;
  tax_components: TaxComponent[];
  launch_areas: string[];
  is_active: boolean;
};

export type CredentialType =
  | 'vet_tech' | 'trainer_cert' | 'groomer_cert' | 'first_aid'
  | 'background_check' | 'insurance' | 'id_document' | 'other';
export type CredentialStatus = 'pending' | 'verified' | 'rejected';
export type RateUnit = 'per_visit' | 'per_walk' | 'per_night' | 'per_trip';

export type CarerProfileRow = {
  user_id: string;
  city_id: string | null;
  status: CarerStatus;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  languages_spoken: string[];
  specialties: string[];
  service_radius_km: number;
  postal_code: string | null;
  country_code: string | null;
  background_check_consent_at: string | null;
  terms_accepted_at: string | null;
  rejection_reason: string | null;
};

export type CredentialRow = {
  id: string;
  type: CredentialType;
  title: string;
  issuer: string | null;
  file_path: string;
  issued_on: string | null;
  expires_on: string | null;
  status: CredentialStatus;
  review_notes: string | null;
};

export type ReferenceRow = {
  id: string;
  name: string;
  relationship: string | null;
  email: string | null;
  phone: string | null;
};

export type CarerServiceRow = { service_id: string; rate_cents: number; is_active: boolean };
