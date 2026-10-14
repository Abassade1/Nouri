import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';

import type { AvailabilityWindow } from '../marketplace/types';
import { previewBookings } from './previewStore';
import type { BookingItem, BookingStatus, Role } from './types';

export interface BookingsRepo {
  list(userId: string, role: Role): Promise<BookingItem[]>;
  get(id: string): Promise<BookingItem | null>;
  setStatus(id: string, status: BookingStatus, reason?: string): Promise<void>;
  listAvailability(carerId: string): Promise<AvailabilityWindow[]>;
  addWindow(carerId: string, weekday: number, start: string, end: string): Promise<void>;
  removeWindow(id: string): Promise<void>;
}

function db() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

const SELECT = `id, status, start_at, end_at, quantity, notes, currency, subtotal_cents, tax_cents, tax_breakdown, total_cents,
  commission_cents, carer_payout_cents, owner_id, carer_id, completed_at, paid_at, transferred_at, refunded_cents,
  services(name_i18n, rate_unit), cities(timezone, cancellation_full_refund_hours, cancellation_late_refund_pct, payout_hold_hours), booking_pets(pets(id, name, species, breed, behaviour_notes))`;

async function hydrate(rows: any[]): Promise<BookingItem[]> {
  if (rows.length === 0) return [];
  const c = db();
  const ids = [...new Set(rows.flatMap((r) => [r.owner_id, r.carer_id]))];
  const [profiles, directory] = await Promise.all([
    c.from('profiles').select('id, full_name').in('id', ids),
    c.from('carer_directory').select('user_id, display_name').in('user_id', rows.map((r) => r.carer_id)),
  ]);
  const names = new Map<string, string | null>((profiles.data ?? []).map((p: any) => [p.id, p.full_name]));
  const carerNames = new Map<string, string | null>((directory.data ?? []).map((d: any) => [d.user_id, d.display_name]));
  return rows.map((r) => ({
    id: r.id, status: r.status, start_at: r.start_at, end_at: r.end_at, quantity: r.quantity, notes: r.notes, currency: r.currency,
    subtotal_cents: r.subtotal_cents, tax_cents: r.tax_cents, tax_breakdown: r.tax_breakdown ?? [], total_cents: r.total_cents,
    commission_cents: r.commission_cents, carer_payout_cents: r.carer_payout_cents, owner_id: r.owner_id, carer_id: r.carer_id,
    owner_name: names.get(r.owner_id) ?? null, carer_name: carerNames.get(r.carer_id) ?? names.get(r.carer_id) ?? null,
    service: r.services, timezone: r.cities?.timezone ?? 'UTC',
    completed_at: r.completed_at, paid_at: r.paid_at, transferred_at: r.transferred_at, refunded_cents: r.refunded_cents ?? 0,
    policy: {
      full_refund_hours: r.cities?.cancellation_full_refund_hours ?? 24,
      late_refund_pct: r.cities?.cancellation_late_refund_pct ?? 50,
      payout_hold_hours: r.cities?.payout_hold_hours ?? 24,
    },
    pets: (r.booking_pets ?? []).map((bp: any) => bp.pets).filter(Boolean),
  }));
}

const supabaseRepo: BookingsRepo = {
  async list(userId, role) {
    const { data, error } = await db().from('bookings').select(SELECT).eq(role === 'owner' ? 'owner_id' : 'carer_id', userId).order('start_at', { ascending: true });
    if (error) throw error;
    return hydrate(data ?? []);
  },
  async get(id) {
    const { data, error } = await db().from('bookings').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? (await hydrate([data]))[0] : null;
  },
  async setStatus(id, status, reason) {
    const patch: Record<string, unknown> = { status };
    if (status === 'cancelled' && reason) patch.cancel_reason = reason;
    const { error } = await db().from('bookings').update(patch).eq('id', id);
    if (error) throw error;
  },
  async listAvailability(carerId) {
    const { data, error } = await db().from('availability').select('id, weekday, start_time, end_time').eq('carer_id', carerId).order('weekday').order('start_time');
    if (error) throw error;
    return (data ?? []) as AvailabilityWindow[];
  },
  async addWindow(carerId, weekday, start, end) {
    const { error } = await db().from('availability').insert({ carer_id: carerId, weekday, start_time: start, end_time: end });
    if (error) throw error;
  },
  async removeWindow(id) {
    const { error } = await db().from('availability').delete().eq('id', id);
    if (error) throw error;
  },
};

let wid = 0;
const previewWindows: (AvailabilityWindow & { carer: string })[] = [1, 2, 3, 4, 5].map((d) => ({ id: `pw${d}`, carer: 'preview-carer', weekday: d, start_time: '09:00', end_time: '17:00' }));

const previewRepo: BookingsRepo = {
  async list(userId, role) {
    // In preview the signed-in "owner" and "carer" see the sample set from their own point of view.
    return previewBookings.all().filter((b) => (role === 'owner' ? b.owner_id === userId || b.owner_id === 'preview-owner' : true)).map((b) => ({ ...b }));
  },
  async get(id) { const b = previewBookings.get(id); return b ? { ...b } : null; },
  async setStatus(id, status) { previewBookings.setStatus(id, status); },
  async listAvailability(carerId) { return previewWindows.filter((w) => w.carer === carerId).map(({ carer: _c, ...w }) => w); },
  async addWindow(carerId, weekday, start, end) { previewWindows.push({ id: `pw-new-${++wid}`, carer: carerId, weekday, start_time: start, end_time: end }); },
  async removeWindow(id) { const i = previewWindows.findIndex((w) => w.id === id); if (i >= 0) previewWindows.splice(i, 1); },
};

export const bookingsRepo: BookingsRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;

/** Maps database error text to translation keys under marketplace:book.errors / bookings:errors. */
export function bookingErrorKey(error: unknown): 'outside_availability' | 'start_too_soon' | 'carer_unavailable' | 'service_not_offered' | 'carer_not_available' | 'generic' {
  const m = String((error as { message?: string } | null)?.message ?? error ?? '');
  for (const k of ['outside_availability', 'start_too_soon', 'carer_unavailable', 'service_not_offered', 'carer_not_available'] as const) {
    if (m.includes(k)) return k;
  }
  return 'generic';
}
