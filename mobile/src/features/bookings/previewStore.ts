import type { I18nText } from '@/lib/format';
import type { RateUnit } from '@/types/db';

import type { BookingItem, BookingStatus } from './types';

/** In-memory bookings for EXPO_PUBLIC_PREVIEW_MODE. Shared by the owner and carer previews. */
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
let n = 0;

const calgary = 'America/Edmonton';
const policy = { full_refund_hours: 24, late_refund_pct: 50, payout_hold_hours: 24 };
const money = { completed_at: null as string | null, paid_at: null as string | null, transferred_at: null as string | null, refunded_cents: 0, policy };
const walk = { name_i18n: { en: 'Dog walking', fr: 'Promenade de chien', ar: 'تمشية الكلاب', zh: '遛狗' } as I18nText, rate_unit: 'per_walk' as RateUnit };
const senior = { name_i18n: { en: 'Senior & medical pet care', fr: 'Soins pour animaux âgés ou malades', ar: 'رعاية الحيوانات المسنّة والمرضى', zh: '老年及医疗宠物护理' } as I18nText, rate_unit: 'per_visit' as RateUnit };

const items: BookingItem[] = [
  {
    id: 'b1', status: 'requested', start_at: hoursFromNow(50), end_at: hoursFromNow(51), quantity: 1, notes: 'Biscuit pulls a little on the leash near the creek.',
    currency: 'CAD', subtotal_cents: 3500, tax_cents: 175, tax_breakdown: [{ code: 'GST', rate: 0.05, cents: 175 }], total_cents: 3675,
    commission_cents: 525, carer_payout_cents: 2975, owner_id: 'preview-owner', carer_id: 'cr-2', owner_name: 'Alex Morgan', carer_name: 'Priya Singh',
    service: walk, timezone: calgary, ...money, pets: [{ id: 'pet-1', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', behaviour_notes: 'Gentle, a little nervous around skateboards.' }],
  },
  {
    id: 'b2', status: 'accepted', start_at: hoursFromNow(120), end_at: hoursFromNow(120.5), quantity: 1, notes: null,
    currency: 'CAD', subtotal_cents: 4500, tax_cents: 225, tax_breakdown: [{ code: 'GST', rate: 0.05, cents: 225 }], total_cents: 4725,
    commission_cents: 675, carer_payout_cents: 3825, owner_id: 'preview-owner', carer_id: 'cr-1', owner_name: 'Alex Morgan', carer_name: 'Casey Morgan, RVT',
    service: senior, timezone: calgary, ...money, pets: [{ id: 'pet-1', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', behaviour_notes: 'Gentle, a little nervous around skateboards.' }],
  },
  {
    id: 'b4', status: 'confirmed', start_at: hoursFromNow(-0.5), end_at: hoursFromNow(0.5), quantity: 1, notes: 'Biscuit\'s tablet goes in a little peanut butter.',
    currency: 'CAD', subtotal_cents: 3500, tax_cents: 175, tax_breakdown: [{ code: 'GST', rate: 0.05, cents: 175 }], total_cents: 3675,
    commission_cents: 525, carer_payout_cents: 2975, owner_id: 'preview-owner', carer_id: 'preview-carer', owner_name: 'Alex Morgan', carer_name: 'Casey Morgan, RVT',
    service: walk, timezone: calgary, ...money, paid_at: hoursFromNow(-30),
    pets: [{ id: 'pet-1', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', behaviour_notes: 'Gentle, a little nervous around skateboards.' }],
  },
  {
    id: 'b3', status: 'completed', start_at: hoursFromNow(-200), end_at: hoursFromNow(-199.5), quantity: 1, notes: null,
    currency: 'CAD', subtotal_cents: 4500, tax_cents: 225, tax_breakdown: [{ code: 'GST', rate: 0.05, cents: 225 }], total_cents: 4725,
    commission_cents: 675, carer_payout_cents: 3825, owner_id: 'preview-owner', carer_id: 'cr-1', owner_name: 'Alex Morgan', carer_name: 'Casey Morgan, RVT',
    service: senior, timezone: calgary, ...money, completed_at: hoursFromNow(-199), paid_at: hoursFromNow(-260), transferred_at: hoursFromNow(-170), pets: [{ id: 'pet-1', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', behaviour_notes: null }],
  },
];

export const previewBookings = {
  all: () => items,
  get: (id: string) => items.find((b) => b.id === id) ?? null,
  create(input: {
    ownerId: string; carerId: string; carerName: string; service: { name_i18n: I18nText; rate_unit: RateUnit };
    startAt: string; endAt: string; quantity: number; notes: string | null; petIds: string[];
    price: { subtotal: number; taxes: { code: string; rate: number; cents: number }[]; tax: number; total: number };
    city: { timezone: string; currency: string };
  }) {
    const id = `b-new-${++n}`;
    const commission = Math.round(input.price.subtotal * 0.15);
    items.unshift({
      id, status: 'requested', start_at: input.startAt, end_at: input.endAt, quantity: input.quantity, notes: input.notes, currency: input.city.currency,
      subtotal_cents: input.price.subtotal, tax_cents: input.price.tax, tax_breakdown: input.price.taxes, total_cents: input.price.total,
      commission_cents: commission, carer_payout_cents: input.price.subtotal - commission, owner_id: input.ownerId, carer_id: input.carerId,
      owner_name: 'Alex Morgan', carer_name: input.carerName, service: input.service, timezone: input.city.timezone, ...money,
      pets: input.petIds.map((pid) => ({ id: pid, name: pid === 'pet-1' ? 'Biscuit' : pid === 'pet-2' ? 'Miso' : 'Pet', species: 'dog', breed: null, behaviour_notes: null })),
    });
    return id;
  },
  setStatus(id: string, status: BookingStatus, patch: Partial<BookingItem> = {}) {
    const b = items.find((x) => x.id === id);
    if (b) Object.assign(b, { status }, patch);
  },
};
