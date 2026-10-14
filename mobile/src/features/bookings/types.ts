import type { I18nText } from '@/lib/format';
import type { MoneyPolicy } from '@/lib/refunds';
import type { RateUnit } from '@/types/db';

export type BookingStatus =
  | 'requested' | 'accepted' | 'declined' | 'payment_failed' | 'confirmed'
  | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export type BookingPet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  behaviour_notes: string | null;
};

export type BookingItem = {
  id: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  quantity: number;
  notes: string | null;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  tax_breakdown: { code: string; rate: number; cents: number }[];
  total_cents: number;
  commission_cents: number;
  carer_payout_cents: number;
  owner_id: string;
  carer_id: string;
  owner_name: string | null;
  carer_name: string | null;
  service: { name_i18n: I18nText; rate_unit: RateUnit };
  timezone: string;
  completed_at: string | null;
  paid_at: string | null;
  transferred_at: string | null;
  refunded_cents: number;
  /** Requested by a Nouri Plus member: shown to carers as priority. */
  is_priority?: boolean;
  policy: MoneyPolicy;
  pets: BookingPet[];
};

export type Role = 'owner' | 'carer';

/** Where a booking sits for display: needs action, upcoming, or finished. */
export const isOpen = (s: BookingStatus) => ['requested', 'accepted', 'payment_failed', 'confirmed', 'in_progress'].includes(s);
