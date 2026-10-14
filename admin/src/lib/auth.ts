import { redirect } from "next/navigation";

import { PREVIEW } from "./preview";
import { createClient } from "./supabase/server";

/** Every admin page and action calls this first: signed in AND role = admin, or you're sent to /login. */
export async function requireAdmin() {
  if (PREVIEW) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin") redirect("/login?error=notAdmin");
}
