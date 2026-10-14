"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { decide, setCredentialStatus, type CredentialStatus } from "@/lib/data";
import { refundOwner, sideWithCarer } from "@/lib/ops";
import { createCity, getCity, languagesEnabled, saveCity } from "@/lib/cities";
import { parseCitySettings, parseNewCity, readNames } from "@/lib/city-form";
import { parseService, parseSlug } from "@/lib/service-form";
import { createService, getService, removeServiceImage, saveService, setServiceImage } from "@/lib/services";
import { deleteWaitlistEntry, markCityContacted } from "@/lib/waitlist";
import { LOCALES } from "@/lib/i18n";
import { PREVIEW } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=invalid");
  await requireAdmin(); // redirects non-admins back with an error
  redirect("/applications");
}

export async function signOut() {
  if (!PREVIEW) await (await createClient()).auth.signOut();
  redirect("/login");
}

export async function setLanguage(formData: FormData) {
  const lang = String(formData.get("lang"));
  if ((LOCALES as readonly string[]).includes(lang)) {
    (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
}

export async function reviewCredential(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("credentialId"));
  const carerId = String(formData.get("carerId"));
  const status = String(formData.get("status")) as CredentialStatus;
  if (!["pending", "verified", "rejected"].includes(status)) return;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const err = await setCredentialStatus(id, status, notes);
  revalidatePath(`/applications/${carerId}`);
  if (err) redirect(`/applications/${carerId}?error=${err}`);
}

export async function decideApplication(formData: FormData) {
  await requireAdmin();
  const carerId = String(formData.get("carerId"));
  const decision = String(formData.get("decision"));
  if (decision !== "approved" && decision !== "rejected") return;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const err = await decide(carerId, decision, reason);
  revalidatePath("/applications");
  revalidatePath(`/applications/${carerId}`);
  if (err) redirect(`/applications/${carerId}?error=${err}`);
  redirect("/applications");
}

/** Decide a dispute: side with the carer (release payout) or refund the owner in full. Needs a written note. */
export async function decideDispute(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") ?? "").trim();
  const back = (error: string) => redirect(`/disputes/${id}?error=${error}`);

  if (decision !== "carer" && decision !== "refund") return;
  if (!note) back("note_required");
  if (decision === "refund" && formData.get("confirm") !== "on") back("confirm_required");

  const err = decision === "refund" ? await refundOwner(id, note) : await sideWithCarer(id, note);
  revalidatePath("/disputes");
  revalidatePath(`/disputes/${id}`);
  if (err) back(err);
  redirect("/disputes?filter=resolved");
}

/** Save a city: names, money rules, launch areas, the live switch and its services. */
export async function saveCityAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("cityId"));
  const back = (q: string) => redirect(`/cities/${id}?${q}`);

  const parsed = parseCitySettings(formData);
  if (!parsed.ok) back(`error=${parsed.error}`);
  else {
    const existing = await getCity(id);
    if (!existing) back("error=generic");
    const names = readNames(formData, existing?.name_i18n ?? {});
    if (!names.en) back("error=name_required");
    const live = formData.get("live") === "on";
    const err = await saveCity(id, parsed.value, names, live, formData.getAll("service").map(String), formData.getAll("allService").map(String));
    revalidatePath("/cities");
    revalidatePath(`/cities/${id}`);
    if (err) back(`error=${err}`);
    back("saved=1");
  }
}

export async function createCityAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseNewCity(formData, await languagesEnabled());
  if (!parsed.ok) redirect(`/cities/new?error=${parsed.error}`);
  else {
    const res = await createCity(parsed.value);
    revalidatePath("/cities");
    if (res.error || !res.id) redirect(`/cities/new?error=${res.error ?? "generic"}`);
    else redirect(`/cities/${res.id}`);
  }
}

/** Mark everyone waiting for a city as contacted. An empty cityId means the typed "other" city named by `other`. */
export async function markContactedAction(formData: FormData) {
  await requireAdmin();
  const cityId = String(formData.get("cityId") ?? "");
  await markCityContacted(cityId || null, String(formData.get("other") ?? "").toLowerCase());
  revalidatePath("/waitlist");
}

export async function deleteWaitlistAction(formData: FormData) {
  await requireAdmin();
  await deleteWaitlistEntry(String(formData.get("id")));
  revalidatePath("/waitlist");
}

/** Save a service's names, descriptions, billing unit, position, icon and whether it's active. */
export async function saveServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("serviceId"));
  const back = (q: string) => redirect(`/services/${id}?${q}`);
  const existing = await getService(id);
  if (!existing) back("error=generic");
  else {
    // A locked unit isn't sent by the browser (disabled field), so keep the current one.
    if (!formData.has("unit")) formData.set("unit", existing.rate_unit);
    const parsed = parseService(formData, existing);
    if (!parsed.ok) back(`error=${parsed.error}`);
    else {
      const err = await saveService(id, parsed.value);
      revalidatePath("/services");
      revalidatePath(`/services/${id}`);
      back(err ? `error=${err}` : "saved=1");
    }
  }
}

export async function serviceImageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("serviceId"));
  const file = formData.get("image");
  const err = formData.get("remove")
    ? await removeServiceImage(id)
    : file instanceof File ? await setServiceImage(id, file) : "image_invalid";
  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  redirect(`/services/${id}?${err ? `error=${err}` : "saved=1"}`);
}

export async function createServiceAction(formData: FormData) {
  await requireAdmin();
  const slug = parseSlug(formData);
  const parsed = parseService(formData);
  if (!slug.ok) redirect(`/services/new?error=${slug.error}`);
  else if (!parsed.ok) redirect(`/services/new?error=${parsed.error}`);
  else {
    const res = await createService(slug.value, parsed.value);
    revalidatePath("/services");
    if (res.error || !res.id) redirect(`/services/new?error=${res.error ?? "generic"}`);
    else redirect(`/services/${res.id}`);
  }
}
