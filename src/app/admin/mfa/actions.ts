"use server";

import { redirect } from "next/navigation";
import { getAdminCandidate } from "@/lib/admin/guard";
import { fail, type ActionState } from "@/lib/admin/state";
import { str } from "@/lib/admin/form";

export type Enrollment = { factorId: string; qr: string; secret: string } | { error: string };

/** Step 1 of setting up 2FA: a new authenticator entry (QR code + key). Only when the account has none yet. */
export async function startEnrollment(): Promise<Enrollment> {
  const candidate = await getAdminCandidate();
  if (!candidate) return { error: "Your session ended. Sign in again." };
  const { supabase } = candidate;

  const { data: list } = await supabase.auth.mfa.listFactors();
  if (list?.totp?.length) return { error: "2FA is already on for this account. Enter your code instead." };
  // An earlier, unfinished attempt would block a new one with the same name.
  for (const f of list?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Reeta Admin",
    friendlyName: `Phone ${Math.random().toString(36).slice(2, 7)}`,
  });
  if (error || !data) return { error: "Couldn't start the setup. Try again in a moment." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Checks the 6-digit code (finishing the setup the first time) and moves the session to the verified level. */
export async function verifyCode(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const candidate = await getAdminCandidate();
  if (!candidate) return fail("Your session ended. Sign in again.");
  const factorId = str(fd, "factorId");
  const code = str(fd, "code").replace(/\s/g, "");
  if (!factorId) return fail("Something went wrong. Reload the page.");
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6 digits from your app.", { code: "Enter the 6 digits from your app." });

  const { error } = await candidate.supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return fail("That code didn't work. Use the newest code from your app, and check that your phone's clock is automatic.");
  }
  redirect("/admin");
}
