"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";

export async function saveCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (name.length < 2) return fail("Add a name.", { name: "Add a name." });
    const { error } = await supabase
      .from("customers")
      .update({ name: name.slice(0, 80), notes: optStr(fd, "notes")?.slice(0, 1000) ?? null, flagged: bool(fd, "flagged") })
      .eq("id", id);
    if (error) return fail(friendlyDbError(error));
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${id}`);
    return ok("Saved.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
