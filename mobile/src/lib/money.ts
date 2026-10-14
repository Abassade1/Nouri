/** "35" or "35,50" or "35.50" -> cents. Returns null when it isn't a sensible amount (1 to 10,000). */
export function parseRateToCents(input: string): number | null {
  const n = Number(input.replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
  return Math.round(n * 100);
}
