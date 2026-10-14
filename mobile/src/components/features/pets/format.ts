import type { TFunction } from 'i18next';

import { ageFromBirthDate } from '@/features/pets/age';

/** "9 yr", "4 mo" or "2 yr 3 mo", localised. */
export function formatAge(birthDate: string | null, t: TFunction<'pets'>): string | null {
  const age = ageFromBirthDate(birthDate);
  if (!age) return null;
  const parts: string[] = [];
  if (age.years > 0) parts.push(t('age.years', { years: age.years }));
  if (age.months > 0 || age.years === 0) parts.push(t('age.months', { months: age.months }));
  return parts.join(' ');
}
