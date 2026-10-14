import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';
import type { WellbeingMetric } from '@/types/pets';

import { bookingsRepo } from '../bookings/repo';
import { previewBookings } from '../bookings/previewStore';
import { previewPetsStore, type PickedImage } from '../pets/repo';

export type Severity = 'info' | 'concern' | 'urgent';
export type Category = 'health' | 'behaviour' | 'other';
export type FlagActionType = 'acknowledged' | 'called_vet' | 'booked_pet_taxi' | 'resolved' | 'note';

export type ScoreInput = { pet_id: string; metric: WellbeingMetric; score: number };

export type ReportInput = {
  bookingId: string;
  summary: string;
  checklist: Record<string, boolean>;
  medicationIds: string[];
  photos: PickedImage[];
  scores: ScoreInput[];
  completeAfter: boolean;
};

export type ReportItem = {
  id: string;
  created_at: string;
  summary: string | null;
  checklist: Record<string, boolean>;
  photo_urls: string[];
  scores: ScoreInput[];
};

export type FlagItem = {
  id: string;
  booking_id: string;
  pet_id: string;
  pet_name: string;
  category: Category;
  severity: Severity;
  notes: string;
  created_at: string;
  photo_urls: string[];
  vet_phone: string | null;
  vet_clinic: string | null;
  actions: { id: string; action: FlagActionType; created_at: string; note: string | null }[];
};

export type ReviewItem = { id: string; booking_id: string; rating: number; comment: string | null; created_at: string };

export type WaitlistInput = {
  email: string;
  cityId: string | null;
  requestedCity: string | null;
  interest: 'owner' | 'carer';
  language: string;
  userId?: string | null;
};

export interface VisitsRepo {
  submitReport(input: ReportInput): Promise<void>;
  listReports(bookingId: string): Promise<ReportItem[]>;
  raiseFlag(input: { bookingId: string; petId: string; category: Category; severity: Severity; notes: string; photos: PickedImage[] }): Promise<void>;
  getFlag(id: string): Promise<FlagItem | null>;
  listOpenFlags(ownerId: string): Promise<FlagItem[]>;
  addFlagAction(flagId: string, action: FlagActionType, opts?: { note?: string; taxiBookingId?: string }): Promise<void>;
  getReview(bookingId: string): Promise<ReviewItem | null>;
  submitReview(bookingId: string, rating: number, comment: string | null): Promise<void>;
  listReviewsForCarer(carerId: string): Promise<ReviewItem[]>;
  disputeBooking(bookingId: string, reason: string): Promise<void>;
  joinWaitlist(input: WaitlistInput): Promise<void>;
}

function db() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const extOf = (mime: string) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg');

async function uploadPhotos(bookingId: string, photos: PickedImage[]): Promise<string[]> {
  const paths: string[] = [];
  for (const p of photos) {
    const buffer = await (await fetch(p.uri)).arrayBuffer();
    const path = `${bookingId}/${uid()}.${extOf(p.mimeType)}`;
    const { error } = await db().storage.from('visit-photos').upload(path, buffer, { contentType: p.mimeType });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

async function signed(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await db().storage.from('visit-photos').createSignedUrls(paths, 3600);
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}

const FLAG_SELECT = 'id, booking_id, pet_id, category, severity, notes, photo_paths, created_at, pets(name, pet_health(vet_phone, vet_clinic)), concern_flag_actions(id, action, note, created_at)';

async function toFlag(r: any): Promise<FlagItem> {
  const health = Array.isArray(r.pets?.pet_health) ? r.pets.pet_health[0] : r.pets?.pet_health;
  return {
    id: r.id, booking_id: r.booking_id, pet_id: r.pet_id, pet_name: r.pets?.name ?? '', category: r.category, severity: r.severity,
    notes: r.notes, created_at: r.created_at, photo_urls: await signed(r.photo_paths ?? []),
    vet_phone: health?.vet_phone ?? null, vet_clinic: health?.vet_clinic ?? null,
    actions: ((r.concern_flag_actions ?? []) as any[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

const supabaseRepo: VisitsRepo = {
  async submitReport(input) {
    const paths = await uploadPhotos(input.bookingId, input.photos);
    const { error } = await db().rpc('submit_visit_report', {
      p_booking: input.bookingId,
      p_summary: input.summary,
      p_checklist: input.checklist,
      p_meds: input.medicationIds,
      p_photos: paths,
      p_started: null,
      p_ended: new Date().toISOString(),
      p_scores: input.scores,
    });
    if (error) throw error;
    if (input.completeAfter) await bookingsRepo.setStatus(input.bookingId, 'completed');
  },

  async listReports(bookingId) {
    const c = db();
    const { data, error } = await c.from('visit_reports').select('id, created_at, summary, checklist, photo_paths').eq('booking_id', bookingId).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    if (!rows.length) return [];
    const { data: scores } = await c.from('wellbeing_scores').select('visit_report_id, pet_id, metric, score').in('visit_report_id', rows.map((r) => r.id));
    return Promise.all(rows.map(async (r) => ({
      id: r.id, created_at: r.created_at, summary: r.summary, checklist: r.checklist ?? {},
      photo_urls: await signed(r.photo_paths ?? []),
      scores: ((scores ?? []) as any[]).filter((s) => s.visit_report_id === r.id).map(({ pet_id, metric, score }) => ({ pet_id, metric, score })),
    })));
  },

  async raiseFlag(input) {
    const paths = await uploadPhotos(input.bookingId, input.photos);
    const { error } = await db().from('concern_flags').insert({
      booking_id: input.bookingId, pet_id: input.petId, category: input.category, severity: input.severity,
      notes: input.notes.trim(), photo_paths: paths,
    });
    if (error) throw error;
  },

  async getFlag(id) {
    const { data, error } = await db().from('concern_flags').select(FLAG_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toFlag(data) : null;
  },

  async listOpenFlags(ownerId) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data, error } = await db().from('concern_flags').select(FLAG_SELECT).eq('owner_id', ownerId).gte('created_at', since).order('created_at', { ascending: false });
    if (error) throw error;
    const flags = await Promise.all((data ?? []).map(toFlag));
    return flags.filter((f) => !f.actions.some((a) => a.action === 'resolved'));
  },

  async addFlagAction(flagId, action, opts) {
    const { error } = await db().from('concern_flag_actions').insert({
      flag_id: flagId, action, note: opts?.note ?? null, taxi_booking_id: opts?.taxiBookingId ?? null,
    });
    if (error) throw error;
  },

  async getReview(bookingId) {
    const { data, error } = await db().from('reviews').select('id, booking_id, rating, comment, created_at').eq('booking_id', bookingId).maybeSingle();
    if (error) throw error;
    return (data as ReviewItem | null) ?? null;
  },

  async submitReview(bookingId, rating, comment) {
    const { error } = await db().from('reviews').insert({ booking_id: bookingId, rating, comment: comment?.trim() || null });
    if (error) throw error;
  },

  async listReviewsForCarer(carerId) {
    const { data, error } = await db().from('reviews').select('id, booking_id, rating, comment, created_at').eq('carer_id', carerId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as ReviewItem[];
  },

  async disputeBooking(bookingId, reason) {
    const { error } = await db().from('bookings').update({ status: 'disputed', dispute_reason: reason.trim() }).eq('id', bookingId);
    if (error) throw error;
  },

  async joinWaitlist(input) {
    const { error } = await db().from('waitlist').insert({
      email: input.email.trim().toLowerCase(), city_id: input.cityId, requested_city: input.requestedCity, interest: input.interest,
      preferred_language: input.language, user_id: input.userId ?? null,
    });
    // Already on the list is a success from the person's point of view.
    if (error && error.code !== '23505') throw error;
  },
};

// ---------------------------------------------------------------------------------------
// Preview mode
// ---------------------------------------------------------------------------------------
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const reports: (ReportItem & { booking_id: string })[] = [
  {
    id: 'r1', booking_id: 'b3', created_at: ago(200), summary: 'Lovely, unhurried visit. Biscuit ate well, took his tablet in peanut butter, and had a gentle 20-minute walk.',
    checklist: { fed: true, walked: true, meds_given: true, water_refreshed: true }, photo_urls: [],
    scores: [{ pet_id: 'pet-1', metric: 'health', score: 4 }, { pet_id: 'pet-1', metric: 'nutrition_hydration', score: 5 }, { pet_id: 'pet-1', metric: 'activity', score: 3 }, { pet_id: 'pet-1', metric: 'happiness', score: 5 }],
  },
];
const flags: FlagItem[] = [
  {
    id: 'f1', booking_id: 'b3', pet_id: 'pet-1', pet_name: 'Biscuit', category: 'health', severity: 'concern',
    notes: 'Slight limp on the back left leg after the second walk. He rested well afterwards and ate normally.', created_at: ago(2),
    photo_urls: [], vet_phone: '+14035550123', vet_clinic: 'Aspen Woods Animal Hospital', actions: [],
  },
];
const reviews: ReviewItem[] = [];
let n = 0;

const previewRepo: VisitsRepo = {
  async submitReport(input) {
    const id = `r-new-${++n}`;
    reports.unshift({ id, booking_id: input.bookingId, created_at: new Date().toISOString(), summary: input.summary || null, checklist: input.checklist, photo_urls: input.photos.map((p) => p.uri), scores: input.scores });
    for (const petId of [...new Set(input.scores.map((s) => s.pet_id))]) {
      previewPetsStore.addScores(petId, input.scores.filter((s) => s.pet_id === petId));
      previewPetsStore.addHistory(petId, { type: 'visit_report', title: null, payload: { checklist: input.checklist, photo_count: input.photos.length } });
    }
    if (input.completeAfter) previewBookings.setStatus(input.bookingId, 'completed', { completed_at: new Date().toISOString() });
  },
  async listReports(bookingId) { return reports.filter((r) => r.booking_id === bookingId).map(({ booking_id: _b, ...r }) => r); },
  async raiseFlag(input) {
    const pet = previewBookings.get(input.bookingId)?.pets.find((p) => p.id === input.petId);
    flags.unshift({
      id: `f-new-${++n}`, booking_id: input.bookingId, pet_id: input.petId, pet_name: pet?.name ?? 'Pet', category: input.category, severity: input.severity,
      notes: input.notes, created_at: new Date().toISOString(), photo_urls: input.photos.map((p) => p.uri), vet_phone: '+14035550123', vet_clinic: 'Aspen Woods Animal Hospital', actions: [],
    });
  },
  async getFlag(id) { const f = flags.find((x) => x.id === id); return f ? { ...f, actions: [...f.actions] } : null; },
  async listOpenFlags() { return flags.filter((f) => !f.actions.some((a) => a.action === 'resolved')).map((f) => ({ ...f })); },
  async addFlagAction(flagId, action, opts) {
    flags.find((f) => f.id === flagId)?.actions.push({ id: `a-${++n}`, action, created_at: new Date().toISOString(), note: opts?.note ?? null });
  },
  async getReview(bookingId) { return reviews.find((r) => r.booking_id === bookingId) ?? null; },
  async submitReview(bookingId, rating, comment) { reviews.push({ id: `rv-${++n}`, booking_id: bookingId, rating, comment, created_at: new Date().toISOString() }); },
  async listReviewsForCarer() {
    return [
      { id: 'pr1', booking_id: 'x', rating: 5, comment: 'Casey handled my senior lab’s medication perfectly and sent photos every visit.', created_at: ago(300) },
      { id: 'pr2', booking_id: 'y', rating: 4, comment: 'Great care. Arrived 10 minutes late once but kept me informed.', created_at: ago(900) },
      ...reviews,
    ];
  },
  async disputeBooking(bookingId) { previewBookings.setStatus(bookingId, 'disputed'); },
  async joinWaitlist() { /* preview: accepted */ },
};

export const visitsRepo: VisitsRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;

export function visitErrorMessage(error: unknown): string {
  return String((error as { message?: string } | null)?.message ?? error ?? '');
}
