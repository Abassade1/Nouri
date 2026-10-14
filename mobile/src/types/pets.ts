export type PetSpecies = 'dog' | 'cat' | 'horse' | 'bird' | 'rabbit' | 'small_mammal' | 'reptile' | 'fish' | 'other';
export type PetSex = 'male' | 'female' | 'unknown';
export type PetTag = 'healthy' | 'senior' | 'special_needs' | 'on_medication';
export type InsuranceStatus = 'unknown' | 'none' | 'insured';
export type WellbeingMetric = 'health' | 'nutrition_hydration' | 'activity' | 'happiness';
export type MedFrequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed';

export type HistoryType =
  | 'visit_report' | 'medication_given' | 'vet_visit' | 'concern_flag' | 'flag_action' | 'booking_completed' | 'note';

export type Pet = {
  id: string;
  owner_id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex;
  is_neutered: boolean | null;
  birth_date: string | null;
  weight_kg: number | null;
  photo_path: string | null;
  tags: PetTag[];
  behaviour_notes: string | null;
  feeding_routine: string | null;
  walking_routine: string | null;
  quirks: string | null;
};

export type PetHealth = {
  microchip_id: string | null;
  insurance_status: InsuranceStatus;
  insurance_provider: string | null;
  medical_notes: string | null;
  allergies: string[];
  vet_clinic: string | null;
  vet_name: string | null;
  vet_phone: string | null;
};

export type Medication = {
  id: string;
  name: string;
  dose: string | null;
  frequency: MedFrequency;
  times: string[]; // "08:00"
  instructions: string | null;
  is_active: boolean;
};

export type WellbeingPoint = { metric: WellbeingMetric; score: number; recorded_at: string };

export type HistoryEvent = {
  id: string;
  type: HistoryType;
  title: string | null;
  payload: Record<string, any>;
  occurred_at: string;
};

export type PetDetail = {
  pet: Pet;
  health: PetHealth;
  medications: Medication[];
  wellbeing: WellbeingPoint[];
  history: HistoryEvent[];
};

export type PetInput = Omit<Pet, 'id' | 'owner_id'>;
export const emptyHealth: PetHealth = {
  microchip_id: null, insurance_status: 'unknown', insurance_provider: null, medical_notes: null,
  allergies: [], vet_clinic: null, vet_name: null, vet_phone: null,
};
