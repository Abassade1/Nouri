import { PREVIEW } from "./preview";
import { adminPreview } from "./preview-admin";
import { createClient } from "./supabase/server";
import type { WaitEntry } from "./waitlist-core";

export async function listWaitlist(): Promise<WaitEntry[]> {
  if (PREVIEW) return [...adminPreview.waitlist()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("waitlist")
    .select("id, email, city_id, requested_city, interest, preferred_language, created_at, notified_at, user_id, cities(name_i18n)")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    id: w.id, email: w.email, city_id: w.city_id, city_name: w.cities?.name_i18n ?? null, requested_city: w.requested_city,
    interest: w.interest, language: w.preferred_language, created_at: w.created_at, notified_at: w.notified_at, signed_in: !!w.user_id,
  }));
}

/** Mark everyone waiting for one city as contacted (use after you've written to them). */
export async function markCityContacted(cityId: string | null, otherKey?: string): Promise<void> {
  if (PREVIEW) return adminPreview.markCityContacted(cityId, otherKey);
  const supabase = await createClient();
  const now = new Date().toISOString();
  if (cityId) {
    await supabase.from("waitlist").update({ notified_at: now }).eq("city_id", cityId).is("notified_at", null);
  } else if (otherKey) {
    const { data } = await supabase.from("waitlist").select("id, requested_city").is("city_id", null).is("notified_at", null);
    const ids = (data ?? []).filter((w: any) => (w.requested_city ?? "").trim().toLowerCase() === otherKey).map((w: any) => w.id);
    if (ids.length) await supabase.from("waitlist").update({ notified_at: now }).in("id", ids);
  }
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  if (PREVIEW) return adminPreview.deleteWaitlist(id);
  const supabase = await createClient();
  await supabase.from("waitlist").delete().eq("id", id);
}
