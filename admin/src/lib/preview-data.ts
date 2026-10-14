import type { Application, CredentialStatus, QueueFilter } from "./data";

/** Sample applications for ADMIN_PREVIEW. Lives in memory, so edits reset when the server restarts. */
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const cal = { name_i18n: { en: "Calgary", fr: "Calgary", ar: "كالغاري" }, currency: "CAD" };
const svc = (en: string, fr: string, ar: string, unit: string, cents: number) => ({
  rate_cents: cents, services: { name_i18n: { en, fr, ar }, rate_unit: unit },
});

const apps: Application[] = [
  {
    user_id: "p1", display_name: "Casey Morgan, RVT", headline: "Registered vet tech specialising in senior dogs",
    bio: "Eight years in small-animal clinics. Calm, methodical, and comfortable with medication schedules and post-surgical care.",
    years_experience: 8, languages_spoken: ["en", "fr"], specialties: ["senior_care", "medication"], service_radius_km: 12,
    postal_code: "T3H 0A1", status: "pending", submitted_at: day(1), reviewed_at: null, rejection_reason: null,
    background_check_consent_at: day(1), terms_accepted_at: day(1), cities: cal,
    credentials: [
      { id: "c1", type: "vet_tech", title: "Registered Veterinary Technician", issuer: "ABVTA", file_path: "x", issued_on: "2018-06-01", expires_on: "2027-06-01", status: "pending", review_notes: null },
      { id: "c2", type: "first_aid", title: "Pet First Aid & CPR", issuer: "Red Cross", file_path: "x", issued_on: "2025-02-10", expires_on: "2027-02-10", status: "pending", review_notes: null },
    ],
    carer_references: [
      { id: "r1", name: "Dr. Helen Park", relationship: "Clinic owner", email: "helen@example.com", phone: null },
      { id: "r2", name: "Marcus Webb", relationship: "Former colleague", email: null, phone: "403-555-0148" },
    ],
    carer_services: [svc("Senior & medical pet care", "Soins pour animaux âgés ou malades", "رعاية الحيوانات المسنّة والمرضى", "per_visit", 4500), svc("Drop-in visit", "Visite à domicile", "زيارة منزلية قصيرة", "per_visit", 3000)],
  },
  {
    user_id: "p2", display_name: "Priya Singh", headline: "Certified dog trainer and weekend walker",
    bio: "Force-free trainer working with anxious and reactive dogs. Fluent in Punjabi and English.",
    years_experience: 5, languages_spoken: ["en", "pa"], specialties: ["anxious_pets", "puppies"], service_radius_km: 8,
    postal_code: "T3Z 3J5", status: "pending", submitted_at: day(3), reviewed_at: null, rejection_reason: null,
    background_check_consent_at: day(3), terms_accepted_at: day(3), cities: cal,
    credentials: [{ id: "c3", type: "trainer_cert", title: "CPDT-KA", issuer: "CCPDT", file_path: "x", issued_on: "2021-09-01", expires_on: null, status: "verified", review_notes: null }],
    carer_references: [{ id: "r3", name: "Anita Rao", relationship: "Client", email: "anita@example.com", phone: null }, { id: "r4", name: "Tom Fischer", relationship: "Employer", email: "tom@example.com", phone: null }],
    carer_services: [svc("Dog walking", "Promenade de chien", "تمشية الكلاب", "per_walk", 3500)],
  },
  {
    user_id: "p3", display_name: "Jordan Lee", headline: null, bio: "Love animals.", years_experience: 1, languages_spoken: ["en"], specialties: [],
    service_radius_km: 5, postal_code: "T3H 1B2", status: "rejected", submitted_at: day(9), reviewed_at: day(7),
    rejection_reason: "Please upload a clearer copy of your first aid certificate and expand your bio with relevant experience.",
    background_check_consent_at: day(9), terms_accepted_at: day(9), cities: cal,
    credentials: [{ id: "c4", type: "first_aid", title: "First aid", issuer: null, file_path: "x", issued_on: null, expires_on: null, status: "rejected", review_notes: "Image is too blurry to read." }],
    carer_references: [], carer_services: [svc("Dog walking", "Promenade de chien", "تمشية الكلاب", "per_walk", 2500)],
  },
];

export const previewStore = {
  list(filter: QueueFilter) {
    return apps.filter((a) => filter === "all" || a.status === filter);
  },
  get(id: string) {
    return apps.find((a) => a.user_id === id) ?? null;
  },
  setCredential(id: string, status: CredentialStatus, notes: string | null) {
    for (const a of apps) {
      const c = a.credentials.find((x) => x.id === id);
      if (c) { c.status = status; c.review_notes = notes; return null; }
    }
    return "generic";
  },
  decide(id: string, decision: "approved" | "rejected", reason: string | null) {
    const a = apps.find((x) => x.user_id === id);
    if (!a) return "generic";
    if (decision === "approved" && !a.credentials.some((c) => c.status === "verified")) return "approval_needs_verified_credential";
    if (decision === "rejected" && !reason?.trim()) return "rejection_needs_reason";
    a.status = decision; a.rejection_reason = decision === "rejected" ? reason : null; a.reviewed_at = new Date().toISOString();
    return null;
  },
};
