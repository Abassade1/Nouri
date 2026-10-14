/** Age helpers. Owners type an age in years/months; we store an approximate birth date. */
export function birthDateFromAge(years: number, months: number, today = new Date()): string {
  const d = new Date(today);
  d.setMonth(d.getMonth() - (years * 12 + months));
  return d.toISOString().slice(0, 10);
}

export function ageFromBirthDate(birthDate: string | null, today = new Date()): { years: number; months: number } | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let total = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
  if (today.getDate() < b.getDate()) total -= 1;
  total = Math.max(0, total);
  return { years: Math.floor(total / 12), months: total % 12 };
}

/** Times like "8:00" or "08:00:00" -> "08:00"; null when invalid. */
export function normalizeTime(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
