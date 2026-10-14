import type { I18nText } from '@/lib/format';
import type { TaxComponent } from '@/lib/pricing';
import type { CredentialType, RateUnit } from '@/types/db';

export type CityInfo = {
  id: string;
  name_i18n: I18nText;
  currency: string;
  timezone: string;
  tax_components: TaxComponent[];
};

export type ServiceInfo = { id: string; slug: string; name_i18n: I18nText; rate_unit: RateUnit };

export type CarerListing = {
  user_id: string;
  city_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  languages_spoken: string[];
  specialties: string[];
  postal_area: string | null;
  rating_avg: number;
  rating_count: number;
  avatar_path: string | null;
  verified_badges: CredentialType[];
  services: { service_id: string; rate_cents: number }[];
};

export type AvailabilityWindow = { id: string; weekday: number; start_time: string; end_time: string };
export type Badge = { type: CredentialType; title: string; issuer: string | null; expires_on: string | null };
export type Review = { id: string; rating: number; comment: string | null; created_at: string; reviewer_first_name: string };

export type CarerDetail = {
  listing: CarerListing;
  badges: Badge[];
  reviews: Review[];
  availability: AvailabilityWindow[];
};

export type NewBooking = {
  carerId: string;
  serviceId: string;
  startAt: string; // ISO (UTC)
  endAt: string;
  quantity: number;
  petIds: string[];
  notes: string | null;
};
