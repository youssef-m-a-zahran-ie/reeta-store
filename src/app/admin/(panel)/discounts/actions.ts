"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";

const CODE_RE = /^[A-Z0-9_-]{3,30}$/;

function refresh() {
  revalidatePath("/admin/discounts");
  revalidatePath("/", "layout");
  revalidatePath("/ar", "layout");
}

/** "2026-10-01T18:00" typed in Cairo time → ISO with offset. */
function cairo(v: string | null) {
  if (!v) return null;
  return /Z|[+-]\d\d:\d\d$/.test(v) ? v : `${v}:00+03:00`;
}

export async function saveDiscount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const id = optStr(fd, "id");
    const type = str(fd, "type") as "percent" | "fixed" | "free_shipping";
    const code = str(fd, "code").toUpperCase().replace(/\s+/g, "");
    const value = num(fd, "value") ?? 0;
    const min = num(fd, "min_subtotal") ?? 0;
    const limit = num(fd, "usage_limit");
    const productIds = fd.getAll("product_ids").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
    const errors: Record<string, string> = {};

    if (!["percent", "fixed", "free_shipping"].includes(type)) errors.type = "Pick a type.";
    if (type !== "free_shipping" && !code) errors.code = "Codes are needed for money off. Automatic offers are free delivery only.";
    if (code && !CODE_RE.test(code)) errors.code = "Use 3–30 letters, numbers, dashes.";
    if (type === "percent" && (Number.isNaN(value) || value <= 0 || value > 100)) errors.value = "Between 1 and 100.";
    if (type === "fixed" && (Number.isNaN(value) || value <= 0)) errors.value = "More than 0.";
    if (Number.isNaN(min) || min < 0) errors.min_subtotal = "0 or more.";
    if (limit !== null && (Number.isNaN(limit) || limit < 1)) errors.usage_limit = "1 or more, or leave empty.";
    if (type === "free_shipping" && !code && min <= 0) errors.min_subtotal = "Automatic free delivery needs a minimum order.";
    if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);

    const row = {
      code: code || null,
      type,
      value: type === "free_shipping" ? 0 : value,
      min_subtotal: min,
      usage_limit: limit === null ? null : Math.round(limit),
      starts_at: cairo(optStr(fd, "starts_at")),
      ends_at: cairo(optStr(fd, "ends_at")),
      product_ids: productIds.length && type !== "free_shipping" ? productIds : null,
      description: optStr(fd, "description"),
      is_active: bool(fd, "is_active"),
    };
    const { error } = id ? await supabase.from("discounts").update(row).eq("id", id) : await supabase.from("discounts").insert(row);
    if (error) return fail(friendlyDbError(error));
    refresh();
    return ok(id ? "Saved." : code ? `Code ${code} is ready.` : "Automatic free delivery is on.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function deleteDiscount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("discount_id", id);
    if (count) return fail("Orders used this discount, so it stays for your reports. Switch it off instead.");
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) return fail(friendlyDbError(error));
    refresh();
    return ok("Deleted.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
