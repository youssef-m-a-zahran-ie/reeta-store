"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { stockLabel } from "@/lib/format";

/** mode: "add" (new batch), "remove" (damaged, samples), "set" (after a count). */
export async function changeStock(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const productId = str(fd, "product_id");
    const variantId = optStr(fd, "variant_id");
    const mode = str(fd, "mode");
    const amount = num(fd, "amount");
    const note = optStr(fd, "note");

    if (amount === null || Number.isNaN(amount) || amount < 0) return fail("Enter an amount.", { amount: "Enter an amount." });
    if (mode !== "set" && amount === 0) return fail("Enter an amount above zero.", { amount: "Above zero." });

    const { data: p } = await supabase.from("products").select("stock_unit, stock_grams, name_en").eq("id", productId).single();
    if (!p) return fail("Product not found.");
    if (p.stock_unit === "pieces" && !variantId) return fail("Pick the size.", { variant_id: "Pick the size." });
    if (p.stock_unit === "pieces" && !Number.isInteger(amount)) return fail("Pieces must be a whole number.");

    let current = p.stock_grams;
    if (p.stock_unit === "pieces") {
      const { data: v } = await supabase.from("variants").select("stock_qty").eq("id", variantId!).eq("product_id", productId).single();
      if (!v) return fail("Size not found.");
      current = v.stock_qty;
    }

    const delta = mode === "add" ? amount : mode === "remove" ? -amount : amount - current;
    if (delta === 0) return ok("Stock already matches. Nothing changed.");
    if (current + delta < 0) return fail(`You can't remove more than what's in stock (${stockLabel(p.stock_unit, current)}).`);

    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId,
      variant_id: p.stock_unit === "pieces" ? variantId : null,
      delta,
      reason: mode === "add" ? "batch" : "adjustment",
      note: note ?? (mode === "set" ? "Stock count" : mode === "remove" ? "Removed" : null),
    });
    if (error) return fail(friendlyDbError(error));

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/catalog/products");
    revalidatePath(`/admin/catalog/products/${productId}`);
    revalidatePath("/admin");
    return ok(`${p.name_en}: now ${stockLabel(p.stock_unit, current + delta)}.`);
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
