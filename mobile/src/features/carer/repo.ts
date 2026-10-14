import { PREVIEW_MODE } from '@/config/app';
import type { I18nText } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type {
  CarerProfileRow, CarerServiceRow, CredentialRow, CredentialType, RateUnit, ReferenceRow,
} from '@/types/db';

export type ApplicationData = {
  profile: CarerProfileRow | null;
  credentials: CredentialRow[];
  references: ReferenceRow[];
  services: CarerServiceRow[];
};

export type CityOption = {
  id: string;
  name_i18n: I18nText;
  country_code: string;
  currency: string;
  commission_rate: number;
  postal_code_regex: string | null;
  postal_code_example: string | null;
};

export type OfferableService = { id: string; slug: string; name_i18n: I18nText; rate_unit: RateUnit };

export type PickedFile = { uri: string; name: string; mimeType: string; size?: number };

export type NewCredential = {
  type: CredentialType;
  title: string;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  file: PickedFile;
};

export type NewReference = Omit<ReferenceRow, 'id'>;

export interface ApplicationRepo {
  load(userId: string): Promise<ApplicationData>;
  listOpenCities(): Promise<CityOption[]>;
  listServicesForCity(cityId: string): Promise<OfferableService[]>;
  saveProfile(userId: string, patch: Partial<CarerProfileRow>): Promise<void>;
  setRate(userId: string, serviceId: string, rateCents: number | null): Promise<void>;
  addCredential(userId: string, input: NewCredential): Promise<void>;
  removeCredential(userId: string, credential: CredentialRow): Promise<void>;
  addReference(userId: string, input: NewReference): Promise<void>;
  removeReference(userId: string, id: string): Promise<void>;
  submit(userId: string): Promise<void>;
}

function client() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

const extOf = (name: string, mime: string) =>
  (name.split('.').pop() || (mime === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');

const supabaseRepo: ApplicationRepo = {
  async load(userId) {
    const db = client();
    const [profile, credentials, references, services] = await Promise.all([
      db.from('carer_profiles').select('*').eq('user_id', userId).maybeSingle(),
      db.from('credentials')
        .select('id, type, title, issuer, file_path, issued_on, expires_on, status, review_notes')
        .eq('carer_id', userId).order('created_at'),
      db.from('carer_references').select('id, name, relationship, email, phone').eq('carer_id', userId).order('created_at'),
      db.from('carer_services').select('service_id, rate_cents, is_active').eq('carer_id', userId),
    ]);
    for (const r of [profile, credentials, references, services]) if (r.error) throw r.error;
    return {
      profile: (profile.data as CarerProfileRow | null) ?? null,
      credentials: (credentials.data as CredentialRow[]) ?? [],
      references: (references.data as ReferenceRow[]) ?? [],
      services: (services.data as CarerServiceRow[]) ?? [],
    };
  },

  async listOpenCities() {
    const { data, error } = await client()
      .from('cities')
      .select('id, name_i18n, country_code, currency, commission_rate, countries(postal_code_regex, postal_code_example)')
      .eq('is_active', true)
      .order('slug');
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      name_i18n: c.name_i18n,
      country_code: c.country_code,
      currency: c.currency,
      commission_rate: Number(c.commission_rate),
      postal_code_regex: c.countries?.postal_code_regex ?? null,
      postal_code_example: c.countries?.postal_code_example ?? null,
    }));
  },

  async listServicesForCity(cityId) {
    const { data, error } = await client()
      .from('city_services')
      .select('services(id, slug, name_i18n, rate_unit, sort_order, is_active)')
      .eq('city_id', cityId)
      .eq('is_enabled', true);
    if (error) throw error;
    return (data ?? [])
      .map((row: any) => row.services)
      .filter((s: any) => s?.is_active)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((s: any) => ({ id: s.id, slug: s.slug, name_i18n: s.name_i18n, rate_unit: s.rate_unit }));
  },

  async saveProfile(userId, patch) {
    const { error } = await client().from('carer_profiles').upsert({ ...patch, user_id: userId }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async setRate(userId, serviceId, rateCents) {
    const db = client();
    if (rateCents === null) {
      const { error } = await db.from('carer_services').delete().eq('carer_id', userId).eq('service_id', serviceId);
      if (error) throw error;
      return;
    }
    const { error } = await db.from('carer_services').upsert(
      { carer_id: userId, service_id: serviceId, rate_cents: rateCents, is_active: true },
      { onConflict: 'carer_id,service_id' },
    );
    if (error) throw error;
  },

  async addCredential(userId, input) {
    const db = client();
    // Read the picked file (works for file:// on phones and blob: on web).
    const buffer = await (await fetch(input.file.uri)).arrayBuffer();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(input.file.name, input.file.mimeType)}`;
    const upload = await db.storage.from('credentials').upload(path, buffer, { contentType: input.file.mimeType });
    if (upload.error) throw upload.error;
    const { error } = await db.from('credentials').insert({
      carer_id: userId, type: input.type, title: input.title, issuer: input.issuer,
      issued_on: input.issued_on, expires_on: input.expires_on, file_path: path,
    });
    if (error) {
      await db.storage.from('credentials').remove([path]); // don't leave an orphan file
      throw error;
    }
  },

  async removeCredential(userId, credential) {
    const db = client();
    const { error } = await db.from('credentials').delete().eq('id', credential.id).eq('carer_id', userId);
    if (error) throw error;
    await db.storage.from('credentials').remove([credential.file_path]);
  },

  async addReference(userId, input) {
    const { error } = await client().from('carer_references').insert({ ...input, carer_id: userId });
    if (error) throw error;
  },

  async removeReference(userId, id) {
    const { error } = await client().from('carer_references').delete().eq('id', id).eq('carer_id', userId);
    if (error) throw error;
  },

  async submit(userId) {
    // The database checks completeness and raises a specific error if anything is missing.
    const { error } = await client().from('carer_profiles').update({ status: 'pending' }).eq('user_id', userId);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------------------
// In-memory version used by EXPO_PUBLIC_PREVIEW_MODE so the whole flow can be clicked through
// without a backend. Mirrors the database's rules closely enough for design review.
// ---------------------------------------------------------------------------------------
const mem: ApplicationData & { rates: Map<string, number> } = {
  profile: null, credentials: [], references: [], services: [], rates: new Map(),
};

const previewCity: CityOption = {
  id: 'c-calgary', name_i18n: { en: 'Calgary', fr: 'Calgary', ar: 'كالغاري', zh: '卡尔加里' },
  country_code: 'CA', currency: 'CAD', commission_rate: 0.15,
  postal_code_regex: '^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] [0-9][ABCEGHJ-NPRSTV-Z][0-9]$',
  postal_code_example: 'T3H 0A1',
};
const previewServices: OfferableService[] = [
  { id: 's1', slug: 'dog_walking', name_i18n: { en: 'Dog walking', fr: 'Promenade de chien', ar: 'تمشية الكلاب', zh: '遛狗' }, rate_unit: 'per_walk' },
  { id: 's2', slug: 'drop_in', name_i18n: { en: 'Drop-in visit', fr: 'Visite à domicile', ar: 'زيارة منزلية قصيرة', zh: '上门探访' }, rate_unit: 'per_visit' },
  { id: 's3', slug: 'overnight_sitting', name_i18n: { en: 'Overnight in-home sitting', fr: 'Garde de nuit à domicile', ar: 'رعاية ليلية في المنزل', zh: '夜间居家陪护' }, rate_unit: 'per_night' },
  { id: 's4', slug: 'senior_medical', name_i18n: { en: 'Senior & medical pet care', fr: 'Soins pour animaux âgés ou malades', ar: 'رعاية الحيوانات المسنّة والمرضى', zh: '老年及医疗宠物护理' }, rate_unit: 'per_visit' },
  { id: 's5', slug: 'pet_taxi', name_i18n: { en: 'Pet taxi to vet or groomer', fr: 'Taxi pour animaux', ar: 'نقل الحيوانات', zh: '宠物接送' }, rate_unit: 'per_trip' },
];
let seq = 0;

const emptyProfile = (userId: string): CarerProfileRow => ({
  user_id: userId, city_id: null, status: 'draft', display_name: null, headline: null, bio: null,
  years_experience: null, languages_spoken: [], specialties: [], service_radius_km: 10, postal_code: null,
  country_code: null, background_check_consent_at: null, terms_accepted_at: null, rejection_reason: null,
});

const previewRepo: ApplicationRepo = {
  async load() {
    return { profile: mem.profile, credentials: [...mem.credentials], references: [...mem.references], services: [...mem.services] };
  },
  async listOpenCities() { return [previewCity]; },
  async listServicesForCity() { return previewServices; },
  async saveProfile(userId, patch) { mem.profile = { ...(mem.profile ?? emptyProfile(userId)), ...patch }; },
  async setRate(_userId, serviceId, rateCents) {
    mem.services = mem.services.filter((s) => s.service_id !== serviceId);
    if (rateCents !== null) mem.services.push({ service_id: serviceId, rate_cents: rateCents, is_active: true });
  },
  async addCredential(_u, input) {
    mem.credentials.push({
      id: `cred-${++seq}`, type: input.type, title: input.title, issuer: input.issuer, file_path: input.file.name,
      issued_on: input.issued_on, expires_on: input.expires_on, status: 'pending', review_notes: null,
    });
  },
  async removeCredential(_u, c) { mem.credentials = mem.credentials.filter((x) => x.id !== c.id); },
  async addReference(_u, input) { mem.references.push({ id: `ref-${++seq}`, ...input }); },
  async removeReference(_u, id) { mem.references = mem.references.filter((r) => r.id !== id); },
  async submit() {
    const p = mem.profile;
    if (!p?.city_id || !p.display_name || !p.bio || !p.postal_code) throw new Error('application_incomplete_profile');
    if (!p.background_check_consent_at || !p.terms_accepted_at) throw new Error('application_missing_consent');
    if (mem.credentials.length < 1) throw new Error('application_needs_credential');
    if (mem.references.length < 2) throw new Error('application_needs_two_references');
    if (mem.services.length < 1) throw new Error('application_needs_service');
    mem.profile = { ...p, status: 'pending' };
  },
};

export const applicationRepo: ApplicationRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
void previewRepo;
