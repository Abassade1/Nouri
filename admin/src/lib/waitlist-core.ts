export type WaitEntry = {
  id: string;
  email: string;
  city_id: string | null;
  city_name: Record<string, string> | null;
  requested_city: string | null;
  interest: "owner" | "carer";
  language: string | null;
  created_at: string;
  notified_at: string | null;
  signed_in: boolean;
};

export type Demand = { key: string; city_id: string | null; label: Record<string, string> | string; owners: number; carers: number; total: number; pending: number };

/** Groups entries by city (typed "other" cities are grouped by what people typed, case-insensitively). */
export function demandByCity(entries: WaitEntry[]): Demand[] {
  const by = new Map<string, Demand>();
  for (const e of entries) {
    const key = e.city_id ?? `other:${(e.requested_city ?? "").trim().toLowerCase()}`;
    const d = by.get(key) ?? {
      key, city_id: e.city_id, label: e.city_id ? (e.city_name ?? {}) : (e.requested_city ?? "").trim(), owners: 0, carers: 0, total: 0, pending: 0,
    };
    by.set(key, d);
    if (e.interest === "owner") d.owners++; else d.carers++;
    d.total++;
    if (!e.notified_at) d.pending++;
  }
  return [...by.values()].sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
}
