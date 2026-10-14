/**
 * Country-agnostic postal code handling. The validation pattern for each country
 * lives in the database (countries.postal_code_regex), so adding a country needs no app change.
 * Returns the cleaned value, or null if it doesn't match.
 */
export function normalizePostalCode(input: string, regex: string | null): string | null {
  const value = input.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!regex) return value || null;
  const pattern = new RegExp(regex);
  if (pattern.test(value)) return value;
  // Accept "T3H0A1" by inserting the space (Canadian-style 3+3 codes).
  const spaced = value.replace(/\s/g, '');
  if (spaced.length === 6) {
    const withSpace = `${spaced.slice(0, 3)} ${spaced.slice(3)}`;
    if (pattern.test(withSpace)) return withSpace;
  }
  return null;
}
