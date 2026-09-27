"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/admin/origin";
import { fail, ok, type ActionState } from "@/lib/admin/state";
import { str } from "@/lib/admin/form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email.", { email: "Enter a valid email." });
  if (!password) return fail("Enter your password.", { password: "Enter your password." });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Confirm your email first. Open the link we sent to your inbox, then sign in.");
    }
    return fail("Email or password is wrong.");
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    await supabase.auth.signOut();
    return fail("This account doesn't have admin access.");
  }
  redirect("/admin");
}

export async function createAdminAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email.", { email: "Enter a valid email." });
  if (password.length < 10) return fail("Use at least 10 characters.", { password: "Use at least 10 characters." });
  if (password !== confirm) return fail("The two passwords don't match.", { confirm: "The two passwords don't match." });

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("is_admin_email", { p_email: email });
  if (!allowed) return fail("This email isn't on the admin list.");

  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/admin/auth/callback?next=/admin` },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("This account already exists. Sign in instead.");
    if (error.code === "weak_password") return fail("Pick a stronger password.");
    return fail(error.message);
  }
  return ok(`Almost done. Open the confirmation link we sent to ${email}, then sign in.`);
}

export async function sendPasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email.", { email: "Enter a valid email." });
  const supabase = await createClient();
  const origin = await requestOrigin();
  // Same answer whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/admin/auth/callback?next=/admin/account` });
  return ok(`If ${email} has an admin account, a reset link is on its way.`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
