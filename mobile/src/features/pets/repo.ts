import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';
import {
  emptyHealth,
  type HistoryEvent, type Medication, type Pet, type PetDetail, type PetHealth, type PetInput,
  type WellbeingPoint,
} from '@/types/pets';

export type PickedImage = { uri: string; mimeType: string };

export interface PetsRepo {
  listPets(ownerId: string): Promise<Pet[]>;
  getPet(petId: string): Promise<PetDetail | null>;
  savePet(ownerId: string, petId: string | null, input: PetInput, health: PetHealth): Promise<string>;
  uploadPhoto(ownerId: string, petId: string, image: PickedImage): Promise<void>;
  photoUrl(path: string | null): Promise<string | null>;
  archivePet(petId: string): Promise<void>;
  addMedication(petId: string, med: Omit<Medication, 'id'>): Promise<void>;
  setMedicationActive(id: string, active: boolean): Promise<void>;
  removeMedication(id: string): Promise<void>;
  addHistory(ownerId: string, petId: string, entry: { type: 'vet_visit' | 'note'; title: string; note: string | null; occurred_at: string }): Promise<void>;
}

function db() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

const PET_COLUMNS =
  'id, owner_id, name, species, breed, sex, is_neutered, birth_date, weight_kg, photo_path, tags, behaviour_notes, feeding_routine, walking_routine, quirks';

const supabaseRepo: PetsRepo = {
  async listPets(ownerId) {
    const { data, error } = await db().from('pets').select(PET_COLUMNS).eq('owner_id', ownerId).is('archived_at', null).order('created_at');
    if (error) throw error;
    return (data ?? []) as Pet[];
  },

  async getPet(petId) {
    const c = db();
    const [pet, health, meds, scores, history] = await Promise.all([
      c.from('pets').select(PET_COLUMNS).eq('id', petId).maybeSingle(),
      c.from('pet_health').select('*').eq('pet_id', petId).maybeSingle(),
      c.from('pet_medications').select('id, name, dose, frequency, times, instructions, is_active').eq('pet_id', petId).order('created_at'),
      c.from('wellbeing_scores').select('metric, score, recorded_at').eq('pet_id', petId).order('recorded_at'),
      c.from('care_history_events').select('id, type, title, payload, occurred_at').eq('pet_id', petId).order('occurred_at', { ascending: false }).limit(60),
    ]);
    for (const r of [pet, health, meds, scores, history]) if (r.error) throw r.error;
    if (!pet.data) return null;
    return {
      pet: pet.data as Pet,
      health: { ...emptyHealth, ...(health.data ?? {}) } as PetHealth,
      medications: ((meds.data ?? []) as any[]).map((m) => ({ ...m, times: (m.times ?? []).map((t: string) => t.slice(0, 5)) })),
      wellbeing: (scores.data ?? []) as WellbeingPoint[],
      history: (history.data ?? []) as HistoryEvent[],
    };
  },

  async savePet(ownerId, petId, input, health) {
    const c = db();
    let id = petId;
    if (id) {
      const { error } = await c.from('pets').update(input).eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await c.from('pets').insert({ ...input, owner_id: ownerId }).select('id').single();
      if (error) throw error;
      id = data.id as string;
    }
    const { error } = await c.from('pet_health').upsert({ ...health, pet_id: id }, { onConflict: 'pet_id' });
    if (error) throw error;
    return id;
  },

  async uploadPhoto(ownerId, petId, image) {
    const c = db();
    const buffer = await (await fetch(image.uri)).arrayBuffer();
    const ext = image.mimeType.includes('png') ? 'png' : image.mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${ownerId}/${petId}/${Date.now()}.${ext}`;
    const up = await c.storage.from('pet-photos').upload(path, buffer, { contentType: image.mimeType });
    if (up.error) throw up.error;
    const { error } = await c.from('pets').update({ photo_path: path }).eq('id', petId);
    if (error) throw error;
  },

  async photoUrl(path) {
    if (!path) return null;
    const { data } = await db().storage.from('pet-photos').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  },

  async archivePet(petId) {
    const { error } = await db().from('pets').update({ archived_at: new Date().toISOString() }).eq('id', petId);
    if (error) throw error;
  },

  async addMedication(petId, med) {
    const { error } = await db().from('pet_medications').insert({ ...med, pet_id: petId });
    if (error) throw error;
  },
  async setMedicationActive(id, active) {
    const { error } = await db().from('pet_medications').update({ is_active: active }).eq('id', id);
    if (error) throw error;
  },
  async removeMedication(id) {
    const { error } = await db().from('pet_medications').delete().eq('id', id);
    if (error) throw error;
  },

  async addHistory(ownerId, petId, entry) {
    const { error } = await db().from('care_history_events').insert({
      pet_id: petId, owner_id: ownerId, type: entry.type, title: entry.title,
      payload: entry.note ? { note: entry.note } : {}, occurred_at: entry.occurred_at,
    });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------------------
// Preview mode: in-memory pets with a realistic history so charts and the timeline can be reviewed.
// ---------------------------------------------------------------------------------------
const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const bd = (years: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10); };

const series: Record<string, number[]> = {
  health: [4, 4, 4, 3, 4, 4, 3, 4],
  nutrition_hydration: [3, 3, 4, 4, 4, 5, 4, 5],
  activity: [4, 3, 3, 3, 2, 3, 3, 3],
  happiness: [4, 5, 4, 5, 5, 5, 4, 5],
};

let n = 0;
const mem = {
  pets: [
    {
      id: 'pet-1', owner_id: 'preview-owner', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', sex: 'male', is_neutered: true,
      birth_date: bd(9), weight_kg: 31.5, photo_path: null, tags: ['senior'], behaviour_notes: 'Gentle, a little nervous around skateboards.',
      feeding_routine: 'Two meals: 7:30 am and 5:30 pm, 1.5 cups each with joint supplement.', walking_routine: 'Two slow 20-minute walks. Stays on leash near the creek.',
      quirks: 'Needs a butter-knife of peanut butter to take his pill.',
    },
    {
      id: 'pet-2', owner_id: 'preview-owner', name: 'Miso', species: 'cat', breed: 'Domestic shorthair', sex: 'female', is_neutered: true,
      birth_date: bd(4), weight_kg: 4.2, photo_path: null, tags: ['healthy'], behaviour_notes: 'Shy with strangers, warms up in ten minutes.',
      feeding_routine: 'Wet food at 8 am and 6 pm.', walking_routine: null, quirks: 'Hides under the bed when the doorbell rings.',
    },
  ] as Pet[],
  health: {
    'pet-1': { microchip_id: '985112345678901', insurance_status: 'insured', insurance_provider: 'Petsecure', medical_notes: 'Hip dysplasia (mild). Avoid stairs where possible.', allergies: ['Chicken'], vet_clinic: 'Aspen Woods Animal Hospital', vet_name: 'Dr. Helen Park', vet_phone: '+14035550123' },
    'pet-2': { ...emptyHealth, vet_clinic: 'Springbank Vet', vet_phone: '+14035550199' },
  } as Record<string, PetHealth>,
  meds: [
    { pet: 'pet-1', id: 'm1', name: 'Meloxicam', dose: '1 ml', frequency: 'daily', times: ['08:00'], instructions: 'With food.', is_active: true },
    { pet: 'pet-1', id: 'm2', name: 'Joint supplement', dose: '1 chew', frequency: 'twice_daily', times: ['08:00', '18:00'], instructions: null, is_active: true },
  ] as (Medication & { pet: string })[],
  history: [] as (HistoryEvent & { pet: string })[],
};
mem.history = [
  { pet: 'pet-1', id: 'h1', type: 'visit_report', title: null, payload: { checklist: { fed: true, walked: true, meds_given: true, water_refreshed: true }, photo_count: 3 }, occurred_at: daysAgo(2, 17) },
  { pet: 'pet-1', id: 'h2', type: 'medication_given', title: 'Meloxicam', payload: { dose: '1 ml' }, occurred_at: daysAgo(2, 17) },
  { pet: 'pet-1', id: 'h3', type: 'concern_flag', title: 'health', payload: { severity: 'concern', notes: 'Slight limp on the back left leg after the second walk. Rested well afterwards.' }, occurred_at: daysAgo(9, 16) },
  { pet: 'pet-1', id: 'h4', type: 'flag_action', title: 'called_vet', payload: { action: 'called_vet' }, occurred_at: daysAgo(9, 16) },
  { pet: 'pet-1', id: 'h5', type: 'vet_visit', title: 'Annual check-up', payload: { note: 'Bloodwork normal. Continue Meloxicam.' }, occurred_at: daysAgo(21, 10) },
  { pet: 'pet-1', id: 'h6', type: 'booking_completed', title: null, payload: {}, occurred_at: daysAgo(30, 18) },
];
const mkScores = (pet: string): WellbeingPoint[] =>
  (Object.keys(series) as (keyof typeof series)[]).flatMap((metric) =>
    series[metric].map((score, i) => ({ metric: metric as WellbeingPoint['metric'], score, recorded_at: daysAgo((7 - i) * 7 + 1) })),
  );

const extraScores: Record<string, WellbeingPoint[]> = {};
/** Lets preview-mode visit reports show up in the owner's pet profile (scores + timeline). */
export const previewPetsStore = {
  addScores(petId: string, scores: { metric: WellbeingPoint['metric']; score: number }[]) {
    (extraScores[petId] ??= []).push(...scores.map((s) => ({ metric: s.metric, score: s.score, recorded_at: new Date().toISOString() })));
  },
  addHistory(petId: string, e: { type: HistoryEvent['type']; title: string | null; payload: Record<string, any> }) {
    mem.history.push({ pet: petId, id: `h-r-${Date.now()}`, type: e.type, title: e.title, payload: e.payload, occurred_at: new Date().toISOString() });
  },
};

const previewRepo: PetsRepo = {
  async listPets() { return mem.pets.map((p) => ({ ...p })); },
  async getPet(id) {
    const pet = mem.pets.find((p) => p.id === id);
    if (!pet) return null;
    return {
      pet: { ...pet },
      health: { ...emptyHealth, ...(mem.health[id] ?? {}) },
      medications: mem.meds.filter((m) => m.pet === id).map(({ pet: _p, ...m }) => m),
      wellbeing: [...(id === 'pet-1' ? mkScores(id) : []), ...(extraScores[id] ?? [])],
      history: mem.history.filter((h) => h.pet === id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).map(({ pet: _p, ...h }) => h),
    };
  },
  async savePet(ownerId, petId, input, health) {
    const id = petId ?? `pet-${++n + 10}`;
    const existing = mem.pets.find((p) => p.id === id);
    if (existing) Object.assign(existing, input);
    else mem.pets.push({ id, owner_id: ownerId, ...input });
    mem.health[id] = health;
    return id;
  },
  async uploadPhoto(_o, petId, image) {
    const p = mem.pets.find((x) => x.id === petId);
    if (p) p.photo_path = image.uri;
  },
  async photoUrl(path) { return path; },
  async archivePet(id) { mem.pets = mem.pets.filter((p) => p.id !== id); },
  async addMedication(petId, med) { mem.meds.push({ pet: petId, id: `med-${++n}`, ...med }); },
  async setMedicationActive(id, active) { const m = mem.meds.find((x) => x.id === id); if (m) m.is_active = active; },
  async removeMedication(id) { mem.meds = mem.meds.filter((m) => m.id !== id); },
  async addHistory(_o, petId, e) {
    mem.history.push({ pet: petId, id: `h-${++n + 100}`, type: e.type, title: e.title, payload: e.note ? { note: e.note } : {}, occurred_at: e.occurred_at });
  },
};

export const petsRepo: PetsRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
