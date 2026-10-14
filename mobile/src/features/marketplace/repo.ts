import { PREVIEW_MODE } from '@/config/app';
import { estimatePrice } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';

import { previewBookings } from '../bookings/previewStore';
import { mediaRepo } from '../media/repo';
import type { CarerPhoto } from '../media/repo';
import type {
  AvailabilityWindow, Badge, CarerDetail, CarerListing, CityInfo, NewBooking, Review, ServiceInfo,
} from './types';

export interface MarketplaceRepo {
  listCities(): Promise<CityInfo[]>;
  listServices(cityId: string): Promise<ServiceInfo[]>;
  searchCarers(cityId: string): Promise<{ carers: CarerListing[]; availability: Record<string, AvailabilityWindow[]> }>;
  getCarer(carerId: string): Promise<CarerDetail | null>;
  createBooking(ownerId: string, input: NewBooking): Promise<string>;
}

function db() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

const supabaseRepo: MarketplaceRepo = {
  async listCities() {
    const { data, error } = await db().from('cities').select('id, name_i18n, currency, timezone, tax_components').eq('is_active', true).order('slug');
    if (error) throw error;
    return (data ?? []) as CityInfo[];
  },

  async listServices(cityId) {
    const { data, error } = await db()
      .from('city_services')
      .select('services(id, slug, name_i18n, rate_unit, sort_order, is_active, image_path)')
      .eq('city_id', cityId)
      .eq('is_enabled', true);
    if (error) throw error;
    return (data ?? [])
      .map((r: any) => r.services)
      .filter((s: any) => s?.is_active)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((s: any) => ({ id: s.id, slug: s.slug, name_i18n: s.name_i18n, rate_unit: s.rate_unit, image_path: s.image_path }));
  },

  async searchCarers(cityId) {
    const c = db();
    const { data, error } = await c.from('carer_directory').select('*').eq('city_id', cityId).order('rating_avg', { ascending: false });
    if (error) throw error;
    const carers = (data ?? []) as CarerListing[];
    const availability: Record<string, AvailabilityWindow[]> = {};
    if (carers.length) {
      const { data: windows, error: e2 } = await c
        .from('availability')
        .select('id, carer_id, weekday, start_time, end_time')
        .in('carer_id', carers.map((x) => x.user_id));
      if (e2) throw e2;
      for (const w of (windows ?? []) as any[]) (availability[w.carer_id] ??= []).push(w);
    }
    return { carers, availability };
  },

  async getCarer(carerId) {
    const c = db();
    const [listing, badges, reviews, windows, photos] = await Promise.all([
      c.from('carer_directory').select('*').eq('user_id', carerId).maybeSingle(),
      c.from('carer_credential_badges').select('type, title, issuer, expires_on').eq('carer_id', carerId),
      c.from('public_reviews').select('id, rating, comment, created_at, reviewer_first_name').eq('carer_id', carerId).order('created_at', { ascending: false }).limit(20),
      c.from('availability').select('id, weekday, start_time, end_time').eq('carer_id', carerId).order('weekday').order('start_time'),
      c.from('carer_photos').select('id, carer_id, path, service_id, caption, sort_order').eq('carer_id', carerId).order('sort_order').order('created_at'),
    ]);
    for (const r of [listing, badges, reviews, windows, photos]) if (r.error) throw r.error;
    if (!listing.data) return null;
    return {
      listing: listing.data as CarerListing,
      badges: (badges.data ?? []) as Badge[],
      reviews: (reviews.data ?? []) as Review[],
      availability: (windows.data ?? []) as AvailabilityWindow[],
      photos: (photos.data ?? []) as CarerPhoto[],
    };
  },

  async createBooking(ownerId, input) {
    const c = db();
    // city_id is a required column; the database overwrites it with the carer's city.
    const { data: carer } = await c.from('carer_directory').select('city_id').eq('user_id', input.carerId).maybeSingle();
    const { data, error } = await c
      .from('bookings')
      .insert({
        owner_id: ownerId, carer_id: input.carerId, city_id: carer?.city_id, service_id: input.serviceId,
        start_at: input.startAt, end_at: input.endAt, quantity: input.quantity, notes: input.notes,
      })
      .select('id')
      .single();
    if (error) throw error;
    const id = data.id as string;
    const { error: petsError } = await c.from('booking_pets').insert(input.petIds.map((pet_id) => ({ booking_id: id, pet_id })));
    if (petsError) {
      await c.from('bookings').update({ status: 'cancelled', cancel_reason: 'incomplete_request' }).eq('id', id);
      throw petsError;
    }
    return id;
  },
};

// ---------------------------------------------------------------------------------------
// Preview data: three approved Calgary carers with badges, services, hours and reviews.
// ---------------------------------------------------------------------------------------
const CAL: CityInfo = {
  id: 'c-calgary', name_i18n: { en: 'Calgary', fr: 'Calgary', ar: 'كالغاري', zh: '卡尔加里' }, currency: 'CAD', timezone: 'America/Edmonton',
  tax_components: [{ code: 'GST', rate: 0.05 }],
};
const previewServices: ServiceInfo[] = [
  { id: 's1', slug: 'dog_walking', name_i18n: { en: 'Dog walking', fr: 'Promenade de chien', ar: 'تمشية الكلاب', zh: '遛狗' }, rate_unit: 'per_walk' },
  { id: 's2', slug: 'drop_in', name_i18n: { en: 'Drop-in visit', fr: 'Visite à domicile', ar: 'زيارة منزلية قصيرة', zh: '上门探访' }, rate_unit: 'per_visit' },
  { id: 's3', slug: 'overnight_sitting', name_i18n: { en: 'Overnight in-home sitting', fr: 'Garde de nuit à domicile', ar: 'رعاية ليلية في المنزل', zh: '夜间居家陪护' }, rate_unit: 'per_night' },
  { id: 's4', slug: 'senior_medical', name_i18n: { en: 'Senior & medical pet care', fr: 'Soins pour animaux âgés ou malades', ar: 'رعاية الحيوانات المسنّة والمرضى', zh: '老年及医疗宠物护理' }, rate_unit: 'per_visit' },
  { id: 's5', slug: 'pet_taxi', name_i18n: { en: 'Pet taxi to vet or groomer', fr: 'Taxi pour animaux', ar: 'نقل الحيوانات', zh: '宠物接送' }, rate_unit: 'per_trip' },
];
const win = (weekday: number, a: string, b: string, i: number): AvailabilityWindow => ({ id: `w${weekday}${i}`, weekday, start_time: a, end_time: b });
const weekdays = (a: string, b: string, days = [1, 2, 3, 4, 5]) => days.map((d, i) => win(d, a, b, i));

const carers: Omit<CarerDetail, 'photos'>[] = [
  {
    listing: {
      user_id: 'cr-1', city_id: 'c-calgary', display_name: 'Casey Morgan, RVT', headline: 'Registered vet tech specialising in senior dogs',
      bio: 'Eight years in small-animal clinics. Calm, methodical, and comfortable with medication schedules and post-surgical care. I send a short, honest report after every visit.',
      years_experience: 8, languages_spoken: ['en', 'fr'], specialties: ['senior_care', 'medication'], postal_area: 'T3H',
      rating_avg: 4.9, rating_count: 27, avatar_path: null, verified_badges: ['vet_tech', 'first_aid', 'background_check'], species_served: ['dog', 'cat', 'horse', 'rabbit'],
      services: [{ service_id: 's4', rate_cents: 4500 }, { service_id: 's2', rate_cents: 3000 }, { service_id: 's5', rate_cents: 4000 }],
    },
    badges: [
      { type: 'vet_tech', title: 'Registered Veterinary Technician', issuer: 'ABVTA', expires_on: '2027-06-01' },
      { type: 'first_aid', title: 'Pet First Aid & CPR', issuer: 'Red Cross', expires_on: '2027-02-10' },
      { type: 'background_check', title: 'Criminal record check', issuer: 'Sterling', expires_on: null },
    ],
    reviews: [
      { id: 'rv1', rating: 5, comment: 'Casey handled my senior lab’s medication perfectly and sent photos every visit.', created_at: '2026-09-28T17:00:00Z', reviewer_first_name: 'Dana' },
      { id: 'rv2', rating: 5, comment: 'Calm, professional, and my anxious cat actually came out to say hello.', created_at: '2026-09-02T17:00:00Z', reviewer_first_name: 'Mohamed' },
      { id: 'rv3', rating: 4, comment: 'Great care. Arrived 10 minutes late once but kept me informed.', created_at: '2026-08-14T17:00:00Z', reviewer_first_name: 'Léa' },
    ],
    availability: [...weekdays('08:00', '18:00'), win(6, '09:00', '13:00', 0)],
  },
  {
    listing: {
      user_id: 'cr-2', city_id: 'c-calgary', display_name: 'Priya Singh', headline: 'Certified trainer for anxious and reactive dogs',
      bio: 'Force-free trainer. Walks are structured, quiet and tailored. Fluent in Punjabi and English.',
      years_experience: 5, languages_spoken: ['en', 'pa'], specialties: ['anxious_pets', 'puppies'], postal_area: 'T3Z',
      rating_avg: 4.7, rating_count: 14, avatar_path: null, verified_badges: ['trainer_cert', 'first_aid'], species_served: ['dog'],
      services: [{ service_id: 's1', rate_cents: 3500 }, { service_id: 's2', rate_cents: 2800 }],
    },
    badges: [
      { type: 'trainer_cert', title: 'CPDT-KA', issuer: 'CCPDT', expires_on: null },
      { type: 'first_aid', title: 'Pet First Aid', issuer: 'St. John Ambulance', expires_on: '2027-05-01' },
    ],
    reviews: [{ id: 'rv4', rating: 5, comment: 'Priya transformed our leash-reactive rescue.', created_at: '2026-09-20T17:00:00Z', reviewer_first_name: 'Chris' }],
    availability: [...weekdays('09:00', '17:00', [1, 3, 5]), win(0, '10:00', '15:00', 0)],
  },
  {
    listing: {
      user_id: 'cr-3', city_id: 'c-calgary', display_name: 'Amal Haddad', headline: 'Overnight sitting for cats and small dogs',
      bio: 'Former clinic receptionist who now sits full-time. Quiet home, no other pets, flexible with arrivals.',
      years_experience: 3, languages_spoken: ['en', 'ar'], specialties: ['senior_care'], postal_area: 'T3H',
      rating_avg: 0, rating_count: 0, avatar_path: null, verified_badges: ['first_aid', 'background_check'], species_served: ['cat', 'bird', 'small_mammal', 'reptile', 'fish'],
      services: [{ service_id: 's3', rate_cents: 9500 }, { service_id: 's2', rate_cents: 2500 }],
    },
    badges: [
      { type: 'first_aid', title: 'Pet First Aid', issuer: 'Red Cross', expires_on: '2027-01-01' },
      { type: 'background_check', title: 'Criminal record check', issuer: 'Sterling', expires_on: null },
    ],
    reviews: [],
    availability: weekdays('16:00', '21:00', [0, 1, 2, 3, 4, 5, 6]),
  },
];

const previewRepo: MarketplaceRepo = {
  async listCities() { return [CAL]; },
  async listServices() { return previewServices; },
  async searchCarers() {
    return { carers: carers.map((c) => c.listing), availability: Object.fromEntries(carers.map((c) => [c.listing.user_id, c.availability])) };
  },
  async getCarer(id) {
    const c = carers.find((x) => x.listing.user_id === id);
    return c ? { ...c, photos: await mediaRepo.listCarerPhotos(id) } : null;
  },
  async createBooking(ownerId, input) {
    const carer = carers.find((c) => c.listing.user_id === input.carerId)!;
    const service = previewServices.find((s) => s.id === input.serviceId)!;
    const rate = carer.listing.services.find((s) => s.service_id === input.serviceId)!.rate_cents;
    const price = estimatePrice(rate, input.quantity, CAL.tax_components);
    return previewBookings.create({
      ownerId, carerId: input.carerId, carerName: carer.listing.display_name ?? '', service, startAt: input.startAt, endAt: input.endAt,
      quantity: input.quantity, notes: input.notes, petIds: input.petIds, price, city: CAL,
    });
  },
};

export const marketplaceRepo: MarketplaceRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
