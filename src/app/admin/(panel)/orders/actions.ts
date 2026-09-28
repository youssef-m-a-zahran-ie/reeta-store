"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/admin/orders";

function refresh(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}

async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function setOrderStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const status = str(fd, "status") as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) return fail("Pick a status.");
    const { error } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: status, p_note: optStr(fd, "note") ?? undefined });
    if (error) return fail(friendlyDbError(error));
    refresh(id);
    return ok(
      status === "cancelled" || status === "refused"
        ? "Updated. The stock from this order is back in inventory."
        : "Status updated.",
    );
  });
}

export async function setPaymentStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase, user } = await assertAdmin();
    const id = str(fd, "id");
    const paid = str(fd, "paid") === "1";
    const { data: o } = await supabase.from("orders").select("payment_status").eq("id", id).single();
    if (!o) return fail("Order not found.");
    const next = paid ? "paid" : "unpaid";
    if (o.payment_status === next) return ok("Nothing changed.");
    const { error } = await supabase.from("orders").update({ payment_status: next }).eq("id", id);
    if (error) return fail(friendlyDbError(error));
    await supabase.from("order_events").insert({ order_id: id, type: "payment", from_value: o.payment_status, to_value: next, created_by: user.id });
    refresh(id);
    return ok(paid ? "Marked as paid." : "Marked as unpaid.");
  });
}

export async function saveInternalNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase, user } = await assertAdmin();
    const id = str(fd, "id");
    const note = optStr(fd, "internal_note");
    const { error } = await supabase.from("orders").update({ internal_note: note }).eq("id", id);
    if (error) return fail(friendlyDbError(error));
    if (note) await supabase.from("order_events").insert({ order_id: id, type: "note", note, created_by: user.id });
    refresh(id);
    return ok("Note saved.");
  });
}
