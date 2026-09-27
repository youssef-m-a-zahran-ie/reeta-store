"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, int, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { slugify } from "@/lib/format";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PALETTE = ["#5b4659", "#f2d0e3", "#f5ead8", "#3a2420", "#a0673f", "#8a9a62", "#c9955f", "#d9607a"];

function wrap(fn: (fd: FormData) => Promise<ActionState>) {
  return async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
    try {
      return await fn(fd);
    } catch (e) {
      if (e instanceof NotAdminError) return fail(e.message);
      throw e;
    }
  };
}

function namesAndSlug(fd: FormData) {
  const name_en = str(fd, "name_en");
  const name_ar = str(fd, "name_ar");
  const slug = str(fd, "slug") || slugify(name_en);
  const errors: Record<string, string> = {};
  if (!name_en) errors.name_en = "Add the English name.";
  if (!name_ar) errors.name_ar = "Add the Arabic name.";
  if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
  return { name_en, name_ar, slug, errors };
}

function refreshCatalog() {
  revalidatePath("/admin/catalog", "layout");
  revalidatePath("/admin");
}

/* ---------- Categories ---------- */
export const saveCategory = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const { name_en, name_ar, slug, errors } = namesAndSlug(fd);
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = {
    name_en,
    name_ar,
    slug,
    description_en: optStr(fd, "description_en"),
    description_ar: optStr(fd, "description_ar"),
    sort: int(fd, "sort"),
    is_visible: bool(fd, "is_visible"),
  };
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok(id ? "Saved." : `Added ${name_en}.`);
});

export const deleteCategory = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", str(fd, "id"));
  if (error) return fail(error.code === "23503" ? "This category still has products. Move them first, or hide the category." : friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});

/* ---------- Bases ---------- */
export const saveBase = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const { name_en, name_ar, slug, errors } = namesAndSlug(fd);
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = { name_en, name_ar, slug, category_id: optStr(fd, "category_id"), sort: int(fd, "sort"), is_active: bool(fd, "is_active") };
  const { error } = id ? await supabase.from("bases").update(row).eq("id", id) : await supabase.from("bases").insert(row);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok(id ? "Saved." : `Added ${name_en}.`);
});

export const deleteBase = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("base_id", id);
  if (count) return fail(`${count} product${count === 1 ? " uses" : "s use"} this base. Switch it off instead.`);
  const { error } = await supabase.from("bases").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});

/* ---------- Coatings ---------- */
export const saveCoating = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const { name_en, name_ar, slug, errors } = namesAndSlug(fd);
  const color = str(fd, "color");
  if (!PALETTE.includes(color)) errors.color = "Pick a color from the brand palette.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = { name_en, name_ar, slug, color, sort: int(fd, "sort"), is_active: bool(fd, "is_active") };
  const { error } = id ? await supabase.from("coatings").update(row).eq("id", id) : await supabase.from("coatings").insert(row);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok(id ? "Saved." : `Added ${name_en}.`);
});

export const deleteCoating = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("coating_id", id);
  if (count) return fail(`${count} product${count === 1 ? " uses" : "s use"} this coating. Switch it off instead.`);
  const { error } = await supabase.from("coatings").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});

/* ---------- Option types and values ---------- */
export const saveOptionType = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const { name_en, name_ar, slug, errors } = namesAndSlug(fd);
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = { name_en, name_ar, slug, unit: optStr(fd, "unit") };
  const { error } = id ? await supabase.from("option_types").update(row).eq("id", id) : await supabase.from("option_types").insert(row);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok(id ? "Saved." : `Added ${name_en}.`);
});

export const deleteOptionType = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("option_type_id", id);
  if (count) return fail(`${count} product${count === 1 ? " is" : "s are"} sold by this option.`);
  const { error } = await supabase.from("option_types").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});

export const saveOptionValue = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const option_type_id = str(fd, "option_type_id");
  const label_en = str(fd, "label_en");
  const label_ar = str(fd, "label_ar");
  const amount = num(fd, "amount");
  const errors: Record<string, string> = {};
  if (!label_en) errors.label_en = "Add the English label.";
  if (!label_ar) errors.label_ar = "Add the Arabic label.";
  if (Number.isNaN(amount) || (amount !== null && amount <= 0)) errors.amount = "Use a number above zero.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = { option_type_id, label_en, label_ar, amount, sort: int(fd, "sort") };

  if (id) {
    const { error } = await supabase.from("option_values").update(row).eq("id", id);
    if (error) return fail(friendlyDbError(error));
    refreshCatalog();
    return ok("Saved.");
  }

  const { data: created, error } = await supabase.from("option_values").insert(row).select("id").single();
  if (error || !created) return fail(friendlyDbError(error));

  // New option: add it to every product and price template sold by this option type.
  const [{ data: products }, { data: templates }] = await Promise.all([
    supabase.from("products").select("id").eq("option_type_id", option_type_id),
    supabase.from("price_templates").select("id").eq("option_type_id", option_type_id),
  ]);
  if (products?.length) {
    await supabase.from("variants").insert(products.map((p) => ({ product_id: p.id, option_value_id: created.id, sort: row.sort })));
  }
  if (templates?.length) {
    await supabase.from("price_template_items").insert(templates.map((t) => ({ template_id: t.id, option_value_id: created.id })));
  }
  refreshCatalog();
  return ok(
    products?.length
      ? `Added ${label_en} to ${products.length} product${products.length === 1 ? "" : "s"}. Set its prices in Price templates.`
      : `Added ${label_en}.`,
  );
});

export const deleteOptionValue = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const variantIds = ((await supabase.from("variants").select("id").eq("option_value_id", id)).data ?? []).map((v) => v.id);
  if (variantIds.length) {
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).in("variant_id", variantIds);
    if (count) return fail("This option has been ordered before. Switch it off on each product instead.");
  }
  const { error: vErr } = await supabase.from("variants").delete().eq("option_value_id", id);
  if (vErr) return fail(vErr.code === "23503" ? "This option is inside a bundle. Remove it from the bundle first." : friendlyDbError(vErr));
  const { error } = await supabase.from("option_values").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});

/* ---------- Price templates ---------- */
export const createPriceTemplate = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const name = str(fd, "name");
  const option_type_id = str(fd, "option_type_id");
  if (!name) return fail("Give the template a name.", { name: "Give the template a name." });
  if (!option_type_id) return fail("Pick what it's sold by.", { option_type_id: "Pick what it's sold by." });
  const { data: t, error } = await supabase
    .from("price_templates")
    .insert({ name, option_type_id, base_id: optStr(fd, "base_id") })
    .select("id")
    .single();
  if (error || !t) return fail(friendlyDbError(error));
  const { data: values } = await supabase.from("option_values").select("id").eq("option_type_id", option_type_id);
  if (values?.length) {
    await supabase.from("price_template_items").insert(values.map((v) => ({ template_id: t.id, option_value_id: v.id })));
  }
  refreshCatalog();
  return ok(`Added ${name}. Fill in its prices below.`);
});

/** Saves the whole price grid: fields named price:<templateId>:<valueId> and cost:<templateId>:<valueId>. */
export const savePriceGrid = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const rows = new Map<string, { template_id: string; option_value_id: string; price: number | null; cost: number | null }>();
  const errors: Record<string, string> = {};
  for (const [key, raw] of fd.entries()) {
    const m = /^(price|cost):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(key);
    if (!m) continue;
    const [, kind, template_id, option_value_id] = m;
    const v = typeof raw === "string" ? raw.trim() : "";
    const n = v === "" ? null : Number(v);
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      errors[key] = "Use a number.";
      continue;
    }
    const k = `${template_id}:${option_value_id}`;
    const row = rows.get(k) ?? { template_id, option_value_id, price: null, cost: null };
    row[kind as "price" | "cost"] = n;
    rows.set(k, row);
  }
  if (Object.keys(errors).length) return fail("Some cells aren't numbers. Fix them and save again.", errors);
  const { error } = await supabase.from("price_template_items").upsert([...rows.values()]);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Prices saved. Every product using these templates is updated.");
});

export const deletePriceTemplate = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("price_template_id", id);
  if (count) return fail(`${count} product${count === 1 ? " uses" : "s use"} this template. Change them first.`);
  const { error } = await supabase.from("price_templates").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refreshCatalog();
  return ok("Deleted.");
});
