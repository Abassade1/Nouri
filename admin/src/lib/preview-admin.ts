import type { CityDetail, CityRow } from "./cities";
import type { CitySettings, NewCity } from "./city-form";
import type { FinanceBooking } from "./finance-core";
import type { PaidRow } from "./finance";
import type { ServiceInput } from "./service-form";
import type { ServiceDetail, ServiceRow } from "./services";
import type { WaitEntry } from "./waitlist-core";

/** Sample data for ADMIN_PREVIEW: payments, cities and waitlist. In memory; resets when the server restarts. */
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const SERVICES = [
  { id: "s1", slug: "dog_walking", name_i18n: { en: "Dog walking", fr: "Promenade de chien", ar: "تمشية الكلاب" } },
  { id: "s2", slug: "drop_in", name_i18n: { en: "Drop-in visit", fr: "Visite à domicile", ar: "زيارة منزلية قصيرة" } },
  { id: "s3", slug: "overnight_sitting", name_i18n: { en: "Overnight in-home sitting", fr: "Garde de nuit à domicile", ar: "رعاية ليلية في المنزل" } },
  { id: "s4", slug: "senior_medical", name_i18n: { en: "Senior & medical pet care", fr: "Soins pour animaux âgés ou malades", ar: "رعاية الحيوانات المسنّة والمرضى" } },
  { id: "s5", slug: "pet_taxi", name_i18n: { en: "Pet taxi to vet or groomer", fr: "Taxi pour animaux", ar: "نقل الحيوانات" } },
];

const base = { cancellation_full_refund_hours: 24, cancellation_late_refund_pct: 50, payout_hold_hours: 24 };
const cities: (CityRow & { enabled: string[]; openBookings: number })[] = [
  { id: "c-cal", slug: "calgary", country_code: "CA", region_code: "AB", name_i18n: { en: "Calgary", fr: "Calgary", ar: "كالغاري" }, timezone: "America/Edmonton", currency: "CAD", default_language: "en", is_active: true, launched_at: ago(900), tax_components: [{ code: "GST", rate: 0.05 }], commission_rate: 0.15, launch_areas: ["Aspen Woods", "Springbank Hill", "West Springs"], ...base, enabled: ["s1", "s2", "s3", "s4", "s5"], openBookings: 4 },
  { id: "c-edm", slug: "edmonton", country_code: "CA", region_code: "AB", name_i18n: { en: "Edmonton", fr: "Edmonton", ar: "إدمونتون" }, timezone: "America/Edmonton", currency: "CAD", default_language: "en", is_active: false, launched_at: null, tax_components: [{ code: "GST", rate: 0.05 }], commission_rate: 0.15, launch_areas: [], ...base, enabled: [], openBookings: 0 },
  { id: "c-tor", slug: "toronto", country_code: "CA", region_code: "ON", name_i18n: { en: "Toronto", fr: "Toronto", ar: "تورنتو" }, timezone: "America/Toronto", currency: "CAD", default_language: "en", is_active: false, launched_at: null, tax_components: [{ code: "HST", rate: 0.13 }], commission_rate: 0.15, launch_areas: [], ...base, enabled: [], openBookings: 0 },
  { id: "c-mtl", slug: "montreal", country_code: "CA", region_code: "QC", name_i18n: { en: "Montréal", fr: "Montréal", ar: "مونتريال" }, timezone: "America/Toronto", currency: "CAD", default_language: "fr", is_active: false, launched_at: null, tax_components: [{ code: "GST", rate: 0.05 }, { code: "QST", rate: 0.09975 }], commission_rate: 0.15, launch_areas: [], ...base, enabled: [], openBookings: 0 },
  { id: "c-dxb", slug: "dubai", country_code: "AE", region_code: "Dubai", name_i18n: { en: "Dubai", fr: "Dubaï", ar: "دبي" }, timezone: "Asia/Dubai", currency: "AED", default_language: "ar", is_active: false, launched_at: null, tax_components: [{ code: "VAT", rate: 0.05 }], commission_rate: 0.15, launch_areas: [], ...base, enabled: [], openBookings: 0 },
];

const audit: { id: string; created_at: string; admin_name: string | null; action: string; entity: string; city_id: string; summary: string }[] = [
  { id: "al1", created_at: ago(900), admin_name: null, action: "insert", entity: "city", city_id: "c-cal", summary: "" },
  { id: "al2", created_at: ago(300), admin_name: "Sam Rivera", action: "update", entity: "city", city_id: "c-cal", summary: "commission_rate" },
];

const waitlist: WaitEntry[] = [
  { id: "w1", email: "mia@example.com", city_id: "c-tor", city_name: { en: "Toronto", fr: "Toronto", ar: "تورنتو" }, requested_city: null, interest: "owner", language: "en", created_at: ago(20), notified_at: null, signed_in: false },
  { id: "w2", email: "jean@example.com", city_id: "c-mtl", city_name: { en: "Montréal", fr: "Montréal", ar: "مونتريال" }, requested_city: null, interest: "owner", language: "fr", created_at: ago(40), notified_at: null, signed_in: false },
  { id: "w3", email: "chloe@example.com", city_id: "c-mtl", city_name: { en: "Montréal", fr: "Montréal", ar: "مونتريال" }, requested_city: null, interest: "carer", language: "fr", created_at: ago(60), notified_at: ago(10), signed_in: true },
  { id: "w4", email: "omar@example.com", city_id: "c-dxb", city_name: { en: "Dubai", fr: "Dubaï", ar: "دبي" }, requested_city: null, interest: "owner", language: "ar", created_at: ago(80), notified_at: null, signed_in: false },
  { id: "w5", email: "li@example.com", city_id: "c-tor", city_name: { en: "Toronto", fr: "Toronto", ar: "تورنتو" }, requested_city: null, interest: "carer", language: "zh", created_at: ago(120), notified_at: null, signed_in: false },
  { id: "w6", email: "sara@example.com", city_id: null, city_name: null, requested_city: "Halifax", interest: "owner", language: "en", created_at: ago(140), notified_at: null, signed_in: false },
  { id: "w7", email: "tom@example.com", city_id: null, city_name: null, requested_city: "halifax", interest: "owner", language: "en", created_at: ago(150), notified_at: null, signed_in: true },
  { id: "w8", email: "ana@example.com", city_id: "c-tor", city_name: { en: "Toronto", fr: "Toronto", ar: "تورنتو" }, requested_city: null, interest: "owner", language: "en", created_at: ago(170), notified_at: null, signed_in: false },
];

const fb = (o: Partial<FinanceBooking> & { id: string }): FinanceBooking => ({
  status: "completed", currency: "CAD", total_cents: 3675, refunded_cents: 0, commission_cents: 525, tax_cents: 175, carer_payout_cents: 2975,
  paid_at: ago(100), completed_at: ago(80), transferred_at: ago(50), hold_hours: 24, ...o,
});
const pr = (b: FinanceBooking, extra: Partial<PaidRow> = {}): PaidRow => ({
  ...b, owner_name: "Alex Morgan", carer_name: "Casey Morgan, RVT", service: { name_i18n: SERVICES[0].name_i18n }, timezone: "America/Edmonton", start_at: b.paid_at ?? ago(100), ...extra,
});
const payments: PaidRow[] = [
  pr(fb({ id: "p1" })),
  pr(fb({ id: "p2", paid_at: ago(200), completed_at: ago(180), transferred_at: ago(150), total_cents: 4725, commission_cents: 675, tax_cents: 225, carer_payout_cents: 3825 }), { owner_name: "Dana Whitfield" }),
  pr(fb({ id: "p3", paid_at: ago(120), completed_at: ago(110), transferred_at: null }), { carer_name: "Priya Singh", owner_name: "Chris Lee" }), // overdue: no payout account
  pr(fb({ id: "p4", status: "confirmed", completed_at: null, transferred_at: null, paid_at: ago(10) }), { owner_name: "Mo Ali" }),
  pr(fb({ id: "p5", status: "cancelled", refunded_cents: 3675, completed_at: null, transferred_at: null, paid_at: ago(300) }), { owner_name: "Jo Park" }),
  pr(fb({ id: "p6", status: "disputed", transferred_at: null, completed_at: ago(40), paid_at: ago(90) }), { owner_name: "Alex Morgan", carer_name: "Priya Singh" }),
  pr(fb({ id: "p7", currency: "AED", total_cents: 10000, commission_cents: 1500, tax_cents: 500, carer_payout_cents: 8500, paid_at: ago(500), completed_at: ago(480), transferred_at: ago(450) }), { owner_name: "Omar K.", carer_name: "Layla H.", timezone: "Asia/Dubai" }),
];


/** The catalogue itself (richer than SERVICES above, which the city screen uses for its tick-list). */
const DESC: Record<string, Record<string, string>> = {
  s1: { en: "A private walk tailored to your dog's pace and routine.", fr: "Une promenade privée adaptée au rythme et à la routine de votre chien.", ar: "جولة خاصة تناسب وتيرة كلبك وروتينه." },
  s2: { en: "A short check-in for feeding, play and medication.", fr: "Une courte visite pour les repas, le jeu et les médicaments.", ar: "زيارة قصيرة للتغذية واللعب وإعطاء الدواء." },
  s3: { en: "A carer stays overnight so your pet keeps their routine at home.", fr: "Un intervenant reste la nuit pour que votre animal garde sa routine à la maison." },
  s4: { en: "Skilled care for older pets and pets with medical needs.", fr: "Des soins qualifiés pour les animaux âgés ou ayant des besoins médicaux.", ar: "رعاية متخصصة للحيوانات الكبيرة في السن أو ذات الاحتياجات الطبية." },
  s5: { en: "Safe, calm transport to appointments." },
};
const UNITS: Record<string, string> = { s1: "per_walk", s2: "per_visit", s3: "per_night", s4: "per_visit", s5: "per_trip" };
const ICONS: Record<string, string> = { s1: "walk", s2: "home", s3: "moon", s4: "heart", s5: "car" };
const catalogue: (ServiceRow & { open_bookings: number; in_use: boolean })[] = SERVICES.map((s, i) => ({
  id: s.id, slug: s.slug, name_i18n: { ...s.name_i18n }, description_i18n: DESC[s.id], rate_unit: UNITS[s.id], icon: ICONS[s.id], sort_order: i + 1,
  is_active: true, cities: 1, carers: [9, 14, 4, 6, 3][i], open_bookings: [5, 3, 1, 2, 0][i], in_use: true,
}));
const serviceAudit: { id: string; service: string; created_at: string; admin_name: string | null; action: string; summary: string }[] = [
  { id: "sa1", service: "s1", created_at: ago(900), admin_name: null, action: "insert", summary: "" },
];

export const adminPreview = {
  services: SERVICES,

  serviceList: (): ServiceRow[] => [...catalogue].sort((a, b) => a.sort_order - b.sort_order).map(({ open_bookings: _o, in_use: _u, ...r }) => r),
  service(id: string): ServiceDetail | null {
    const c = catalogue.find((x) => x.id === id);
    return c ? { ...c, audit: serviceAudit.filter((a) => a.service === id).sort((a, b) => b.created_at.localeCompare(a.created_at)) } : null;
  },
  saveService(id: string, input: ServiceInput): string | null {
    const c = catalogue.find((x) => x.id === id);
    if (!c) return "generic";
    if (c.in_use && input.rate_unit !== c.rate_unit) return "rate_unit_locked";
    const before = JSON.stringify([c.name_i18n, c.description_i18n, c.rate_unit, c.icon, c.sort_order, c.is_active]);
    Object.assign(c, input);
    if (before !== JSON.stringify([c.name_i18n, c.description_i18n, c.rate_unit, c.icon, c.sort_order, c.is_active])) {
      serviceAudit.push({ id: `sa${serviceAudit.length + 1}`, service: id, created_at: new Date().toISOString(), admin_name: "Sam Rivera", action: "update", summary: "name_i18n, description_i18n" });
    }
    return null;
  },
  createService(slug: string, input: ServiceInput): { id?: string; error?: string } {
    if (catalogue.some((c) => c.slug === slug)) return { error: "service_slug_taken" };
    const id = `s-${slug}`;
    catalogue.push({ id, slug, ...input, cities: 0, carers: 0, open_bookings: 0, in_use: false });
    serviceAudit.push({ id: `sa${serviceAudit.length + 1}`, service: id, created_at: new Date().toISOString(), admin_name: "Sam Rivera", action: "insert", summary: "" });
    return { id };
  },
  payments: () => payments,
  failedCount: () => 1,
  openDisputes: () => 1,

  cities: () => cities.map(({ enabled, openBookings: _o, ...c }) => ({ ...c, services: enabled.length })),
  city(id: string): CityDetail | null {
    const c = cities.find((x) => x.id === id);
    if (!c) return null;
    const { enabled, openBookings, ...row } = c;
    return {
      ...row, services_enabled: enabled.length, open_bookings: openBookings,
      // Active catalogue entries, so a service created in preview shows up here too.
      services: catalogue.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ id: s.id, slug: s.slug, name_i18n: s.name_i18n, enabled: enabled.includes(s.id) })),
      audit: audit.filter((a) => a.city_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  },
  saveCity(id: string, s: CitySettings, names: Record<string, string>, live: boolean, enabled: string[]): string | null {
    const c = cities.find((x) => x.id === id);
    if (!c) return "generic";
    if (live && enabled.length === 0) return "city_needs_service";
    Object.assign(c, s, { name_i18n: names, enabled, is_active: live, launched_at: live ? c.launched_at ?? new Date().toISOString() : c.launched_at });
    audit.push({ id: `al${audit.length + 1}`, created_at: new Date().toISOString(), admin_name: "Sam Rivera", action: "update", entity: "city", city_id: id, summary: "commission_rate, tax_components" });
    return null;
  },
  createCity(n: NewCity): { id?: string; error?: string } {
    if (cities.some((c) => c.slug === n.slug)) return { error: "slug_taken" };
    const id = `c-${n.slug}`;
    cities.push({ id, slug: n.slug, country_code: n.country_code, region_code: n.region_code, name_i18n: n.name_i18n, timezone: n.timezone, currency: n.currency, default_language: n.default_language, is_active: false, launched_at: null, tax_components: [], commission_rate: 0.15, launch_areas: [], ...base, enabled: [], openBookings: 0 });
    return { id };
  },

  waitlist: () => waitlist,
  markCityContacted(cityId: string | null, otherKey?: string) {
    for (const w of waitlist) {
      const hit = cityId ? w.city_id === cityId : !w.city_id && (w.requested_city ?? "").trim().toLowerCase() === otherKey;
      if (hit && !w.notified_at) w.notified_at = new Date().toISOString();
    }
  },
  deleteWaitlist(id: string) { const i = waitlist.findIndex((w) => w.id === id); if (i >= 0) waitlist.splice(i, 1); },
};
