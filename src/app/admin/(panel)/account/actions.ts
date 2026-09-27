"use server";

import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { str } from "@/lib/admin/form";
import { fail, ok, type ActionState } from "@/lib/admin/state";

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const password = str(fd, "password");
    const confirm = str(fd, "confirm");
    if (password.length < 10) return fail("Use at least 10 characters.", { password: "Use at least 10 characters." });
    if (password !== confirm) return fail("The two passwords don't match.", { confirm: "The two passwords don't match." });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password") return fail("That's your current password. Pick a new one.");
      if (error.code === "weak_password") return fail("Pick a stronger password.");
      return fail(error.message);
    }
    return ok("Password changed.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
