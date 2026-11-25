import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the signed-in admin and a Supabase client, or null.
 * An admin counts only after the second step (a code from their authenticator app): the session must be at assurance level aal2.
 */
export async function getAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.aal !== "aal2") return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return { supabase, user };
}

/** Someone who signed in with an admin email but hasn't done the second step yet (for the 2FA page only). */
export async function getAdminCandidate() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) return null;
  const { data: allowed } = await supabase.rpc("is_admin_email", { p_email: user.email });
  if (!allowed) return null;
  return { supabase, user };
}

/** For pages and layouts: sends anyone who isn't an admin to the login page. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login?denied=1");
  return admin;
}

export class NotAdminError extends Error {
  constructor() {
    super("Your session ended. Sign in again.");
  }
}

/** For server actions: throws when the caller isn't an admin. Every action must call this. */
export async function assertAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new NotAdminError();
  return admin;
}
