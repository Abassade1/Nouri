export type TaxComponent = { code: string; rate: number };

/**
 * A preview of what the database will charge. The database recomputes the real numbers when the
 * request is created (same rounding), so this is only for showing the owner an estimate.
 */
export function estimatePrice(rateCents: number, quantity: number, taxes: TaxComponent[]) {
  const subtotal = rateCents * quantity;
  const lines = taxes.map((t) => ({ code: t.code, rate: t.rate, cents: Math.round(subtotal * t.rate) }));
  const tax = lines.reduce((sum, l) => sum + l.cents, 0);
  return { subtotal, taxes: lines, tax, total: subtotal + tax };
}
