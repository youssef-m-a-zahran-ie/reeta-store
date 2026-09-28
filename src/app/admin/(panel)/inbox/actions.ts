"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";

async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    const res = await fn();
    revalidatePath("/admin", "layout");
    return res;
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function setMessageRead(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const read = str(fd, "read") === "1";
    const { error } = await supabase.from("messages").update({ is_read: read }).eq("id", str(fd, "id"));
    if (error) return fail(friendlyDbError(error));
    return ok(read ? "Marked as read." : "Marked as unread.");
  });
}

export async function markReplied(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("messages").update({ is_read: true, replied_at: new Date().toISOString() }).eq("id", str(fd, "id"));
    if (error) return fail(friendlyDbError(error));
    return ok("Marked as replied.");
  });
}

export async function markAllRead(): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("messages").update({ is_read: true }).eq("is_read", false);
    if (error) return fail(friendlyDbError(error));
    return ok("All caught up.");
  });
}

export async function deleteMessage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("messages").delete().eq("id", str(fd, "id"));
    if (error) return fail(friendlyDbError(error));
    return ok("Deleted.");
  });
}
