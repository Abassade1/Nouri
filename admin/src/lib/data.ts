import { PREVIEW } from "./preview";
import { previewStore } from "./preview-data";
import { createClient } from "./supabase/server";

export type I18nText = Record<string, string>;
export type CarerStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";
export type CredentialStatus = "pending" | "verified" | "rejected";

export type CredentialItem = {
  id: string; type: string; title: string; issuer: string | null; file_path: string;
  issued_on: string | null; expires_on: string | null; status: CredentialStatus; review_notes: string | null;
};
export type ReferenceItem = { id: string; name: string; relationship: string | null; email: string | null; phone: string | null };
export type ServiceItem = { rate_cents: number; services: { name_i18n: I18nText; rate_unit: string } | null };

export type Application = {
  user_id: string;
  display_name: string | null; headline: string | null; bio: string | null;
  years_experience: number | null; languages_spoken: string[]; specialties: string[];
  service_radius_km: number; postal_code: string | null;
  status: CarerStatus; submitted_at: string | null; reviewed_at: string | null; rejection_reason: string | null;
  background_check_consent_at: string | null; terms_accepted_at: string | null;
  cities: { name_i18n: I18nText; currency: string } | null;
  credentials: CredentialItem[]; carer_references: ReferenceItem[]; carer_services: ServiceItem[];
};

export type QueueFilter = "pending" | "rejected" | "approved" | "all";

const SELECT = `user_id, display_name, headline, bio, years_experience, languages_spoken, specialties, service_radius_km,
  postal_code, status, submitted_at, reviewed_at, rejection_reason, background_check_consent_at, terms_accepted_at,
  cities(name_i18n, currency),
  credentials(id, type, title, issuer, file_path, issued_on, expires_on, status, review_notes),
  carer_references(id, name, relationship, email, phone),
  carer_services(rate_cents, services(name_i18n, rate_unit))`;

export async function listApplications(filter: QueueFilter): Promise<Application[]> {
  if (PREVIEW) return previewStore.list(filter);
  const supabase = await createClient();
  let query = supabase.from("carer_profiles").select(SELECT).neq("status", "draft");
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query.order("submitted_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as Application[];
}

export async function getApplication(id: string): Promise<Application | null> {
  if (PREVIEW) return previewStore.get(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("carer_profiles").select(SELECT).eq("user_id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Application) ?? null;
}

export async function getFullName(id: string): Promise<string | null> {
  if (PREVIEW) return previewStore.get(id)?.display_name ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? null;
}

/** Short-lived link (5 minutes) to a private document. Only works for admins (storage rules). */
export async function documentUrl(path: string): Promise<string | null> {
  if (PREVIEW) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("credentials").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function setCredentialStatus(id: string, status: CredentialStatus, notes: string | null): Promise<string | null> {
  if (PREVIEW) return previewStore.setCredential(id, status, notes);
  const supabase = await createClient();
  const { error } = await supabase.from("credentials").update({ status, review_notes: notes }).eq("id", id);
  return error ? errorKey(error.message) : null;
}

export async function decide(id: string, decision: "approved" | "rejected", reason: string | null): Promise<string | null> {
  if (PREVIEW) return previewStore.decide(id, decision, reason);
  const supabase = await createClient();
  const { error } = await supabase
    .from("carer_profiles")
    .update({ status: decision, rejection_reason: decision === "rejected" ? reason : null })
    .eq("user_id", id);
  return error ? errorKey(error.message) : null;
}

const KNOWN = ["approval_needs_verified_credential", "rejection_needs_reason"];
function errorKey(message: string): string {
  return KNOWN.find((k) => message.includes(k)) ?? "generic";
}
