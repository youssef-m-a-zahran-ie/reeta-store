"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, int, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { slugify } from "@/lib/format";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["product_status"];
type Supa = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PALETTE = ["#5b4659", "#f2d0e3", "#f5ead8", "#3a2420", "#a0673f", "#8a9a62", "#c9955f", "#d9607a"];

function refresh(id?: string) {
  revalidatePath("/admin/catalog/products");
  if (id) revalidatePath(`/admin/catalog/products/${id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
}

async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

/** Makes sure the product has one variant per option value (or one plain variant if it has no option type). */
async function syncVariants(supabase: Supa, productId: string, optionTypeId: string | null) {
  const { data: existing } = await supabase.from("variants").select("id, option_value_id").eq("product_id", productId);
  const current = existing ?? [];

  if (!optionTypeId) {
    if (!current.some((v) => v.option_value_id === null)) {
      await supabase.from("variants").insert({ product_id: productId, option_value_id: null, label_en: "Standard", label_ar: "عادي" });
    }
  } else {
    const { data: values } = await supabase.from("option_values").select("id, sort").eq("option_type_id", optionTypeId);
    const have = new Set(current.map((v) => v.option_value_id));
    const missing = (values ?? []).filter((v) => !have.has(v.id));
    if (missing.length) {
      await supabase.from("variants").insert(missing.map((v) => ({ product_id: productId, option_value_id: v.id, sort: v.sort })));
    }
  }

  // Variants that no longer match the option type: remove when never sold, otherwise switch off.
  const { data: all } = await supabase
    .from("variants")
    .select("id, option_value_id, option_values(option_type_id)")
    .eq("product_id", productId);
  const stale = (all ?? []).filter((v) =>
    optionTypeId ? v.option_value_id === null || v.option_values?.option_type_id !== optionTypeId : v.option_value_id !== null,
  );
  for (const v of stale) {
    const { error } = await supabase.from("variants").delete().eq("id", v.id);
    if (error) await supabase.from("variants").update({ is_active: false }).eq("id", v.id);
  }
}

/** Returns a reason the product can't go live, or null. */
async function activationProblem(supabase: Supa, productId: string) {
  const { data: prices } = await supabase
    .from("variant_prices")
    .select("variant_id, price, is_active")
    .eq("product_id", productId);
  const active = (prices ?? []).filter((p) => p.is_active);
  if (!active.length) return "switch on at least one size";
  const missing = active.filter((p) => p.price === null).length;
  if (missing) return `${missing} size${missing === 1 ? " has" : "s have"} no price yet`;
  return null;
}

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = optStr(fd, "id");
    const name_en = str(fd, "name_en");
    const name_ar = str(fd, "name_ar");
    const slug = str(fd, "slug") || slugify(name_en);
    const category_id = str(fd, "category_id");
    const color = optStr(fd, "color");
    const threshold = num(fd, "low_stock_threshold");
    const requested = (str(fd, "status") || "draft") as Status;

    const errors: Record<string, string> = {};
    if (!name_en) errors.name_en = "Add the English name.";
    if (!name_ar) errors.name_ar = "Add the Arabic name.";
    if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
    if (!category_id) errors.category_id = "Pick a category.";
    if (color && !PALETTE.includes(color)) errors.color = "Pick a color from the brand palette.";
    if (threshold !== null && (Number.isNaN(threshold) || threshold < 0)) errors.low_stock_threshold = "Use a number.";
    if (!["draft", "active", "archived"].includes(requested)) errors.status = "Pick a status.";
    if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);

    const option_type_id = optStr(fd, "option_type_id");
    const row = {
      name_en,
      name_ar,
      slug,
      category_id,
      short_en: optStr(fd, "short_en"),
      short_ar: optStr(fd, "short_ar"),
      description_en: optStr(fd, "description_en"),
      description_ar: optStr(fd, "description_ar"),
      ingredients_en: optStr(fd, "ingredients_en"),
      ingredients_ar: optStr(fd, "ingredients_ar"),
      allergens_en: optStr(fd, "allergens_en"),
      allergens_ar: optStr(fd, "allergens_ar"),
      storage_en: optStr(fd, "storage_en"),
      storage_ar: optStr(fd, "storage_ar"),
      base_id: optStr(fd, "base_id"),
      coating_id: optStr(fd, "coating_id"),
      color,
      option_type_id,
      price_template_id: optStr(fd, "price_template_id"),
      stock_unit: (str(fd, "stock_unit") === "grams" ? "grams" : "pieces") as "grams" | "pieces",
      low_stock_threshold: threshold ?? 0,
      is_featured: bool(fd, "is_featured"),
      sort: int(fd, "sort"),
      seo_title: optStr(fd, "seo_title"),
      seo_description: optStr(fd, "seo_description"),
    };

    // A template must match how the product is sold.
    if (row.price_template_id) {
      const { data: t } = await supabase.from("price_templates").select("option_type_id").eq("id", row.price_template_id).single();
      if (t && t.option_type_id !== option_type_id) {
        return fail("That price template is for a different option. Pick a matching one.", {
          price_template_id: "Doesn't match how it's sold.",
        });
      }
    }

    let productId = id;
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) return fail(friendlyDbError(error));
    } else {
      const { data, error } = await supabase.from("products").insert({ ...row, status: "draft" }).select("id").single();
      if (error || !data) return fail(friendlyDbError(error));
      productId = data.id;
    }

    await syncVariants(supabase, productId!, option_type_id);

    let message = id ? "Saved." : "Product created.";
    if (requested === "active") {
      const problem = await activationProblem(supabase, productId!);
      if (problem) {
        await supabase.from("products").update({ status: "draft" }).eq("id", productId!);
        refresh(productId!);
        if (!id) redirect(`/admin/catalog/products/${productId}?created=1`);
        return fail(`Saved as a draft: ${problem}. Fix that in “Sizes and prices”, then make it active.`);
      }
      await supabase.from("products").update({ status: "active" }).eq("id", productId!);
      message = id ? "Saved. It's live on the store." : message;
    } else if (id) {
      await supabase.from("products").update({ status: requested }).eq("id", productId!);
    }

    refresh(productId!);
    if (!id) redirect(`/admin/catalog/products/${productId}?created=1`);
    return ok(message);
  });
}

/** Saves the sizes table: on:<variantId>, price:<variantId>, cost:<variantId>. */
export async function saveVariants(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const productId = str(fd, "product_id");
    const ids = fd.getAll("variant_id").map(String);
    const errors: Record<string, string> = {};
    const updates: { id: string; is_active: boolean; price: number | null; cost: number | null; label_en?: string; label_ar?: string }[] = [];

    for (const vid of ids) {
      const price = num(fd, `price:${vid}`);
      const cost = num(fd, `cost:${vid}`);
      if (Number.isNaN(price) || (price !== null && price < 0)) errors[`price:${vid}`] = "Use a number.";
      if (Number.isNaN(cost) || (cost !== null && cost < 0)) errors[`cost:${vid}`] = "Use a number.";
      const u: (typeof updates)[number] = { id: vid, is_active: bool(fd, `on:${vid}`), price, cost };
      if (fd.has(`label_en:${vid}`)) {
        u.label_en = str(fd, `label_en:${vid}`) || "Standard";
        u.label_ar = str(fd, `label_ar:${vid}`) || "عادي";
      }
      updates.push(u);
    }
    if (Object.keys(errors).length) return fail("Some prices aren't numbers.", errors);

    for (const u of updates) {
      const { id, ...rest } = u;
      const { error } = await supabase.from("variants").update(rest).eq("id", id).eq("product_id", productId);
      if (error) return fail(friendlyDbError(error));
    }

    // A live product can't be left without sellable sizes.
    const { data: p } = await supabase.from("products").select("status").eq("id", productId).single();
    if (p?.status === "active") {
      const problem = await activationProblem(supabase, productId);
      if (problem) {
        await supabase.from("products").update({ status: "draft" }).eq("id", productId);
        refresh(productId);
        return fail(`Saved, and moved to draft because ${problem}.`);
      }
    }
    refresh(productId);
    return ok("Sizes and prices saved.");
  });
}

export async function addProductImages(productId: string, paths: string[]): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const valid = paths.filter((p) => p.startsWith(`products/${productId}/`));
    if (!valid.length) return fail("Nothing to add.");
    const { data: last } = await supabase
      .from("product_images")
      .select("sort")
      .eq("product_id", productId)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (last?.sort ?? -1) + 1;
    const { error } = await supabase.from("product_images").insert(valid.map((path, i) => ({ product_id: productId, path, sort: start + i })));
    if (error) return fail(friendlyDbError(error));
    refresh(productId);
    return ok(`${valid.length} photo${valid.length === 1 ? "" : "s"} added.`);
  });
}

export async function updateProductImages(
  productId: string,
  images: { id: string; alt_en: string; alt_ar: string }[],
): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    for (const [i, img] of images.entries()) {
      const { error } = await supabase
        .from("product_images")
        .update({ sort: i, alt_en: img.alt_en || null, alt_ar: img.alt_ar || null })
        .eq("id", img.id)
        .eq("product_id", productId);
      if (error) return fail(friendlyDbError(error));
    }
    refresh(productId);
    return ok("Photos saved.");
  });
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { data: img } = await supabase.from("product_images").select("path").eq("id", imageId).eq("product_id", productId).single();
    if (!img) return fail("That photo is already gone.");
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return fail(friendlyDbError(error));
    await supabase.storage.from(MEDIA_BUCKET).remove([img.path]);
    refresh(productId);
    return ok("Photo removed.");
  });
}

export async function deleteProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (count) return fail("This product has orders, so it stays for your reports. Set it to Archived instead.");
    const { data: imgs } = await supabase.from("product_images").select("path").eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return fail(error.code === "23503" ? "This product is inside a bundle. Remove it from the bundle first." : friendlyDbError(error));
    if (imgs?.length) await supabase.storage.from(MEDIA_BUCKET).remove(imgs.map((i) => i.path));
    refresh();
    redirect("/admin/catalog/products?deleted=1");
  });
}

export async function duplicateProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
    if (!p) return fail("Product not found.");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _c, updated_at: _u, stock_grams: _s, ...rest } = p;
    let slug = `${p.slug}-copy`;
    for (let n = 2; n < 50; n++) {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("slug", slug);
      if (!count) break;
      slug = `${p.slug}-copy-${n}`;
    }
    const { data: copy, error } = await supabase
      .from("products")
      .insert({ ...rest, slug, name_en: `${p.name_en} (copy)`, name_ar: `${p.name_ar} (نسخة)`, status: "draft", is_featured: false })
      .select("id")
      .single();
    if (error || !copy) return fail(friendlyDbError(error));
    const { data: vars } = await supabase.from("variants").select("*").eq("product_id", id);
    if (vars?.length) {
      await supabase.from("variants").insert(
        vars.map((v) => ({
          product_id: copy.id,
          option_value_id: v.option_value_id,
          label_en: v.label_en,
          label_ar: v.label_ar,
          price: v.price,
          cost: v.cost,
          is_active: v.is_active,
          sort: v.sort,
        })),
      );
    }
    refresh();
    redirect(`/admin/catalog/products/${copy.id}?copied=1`);
  });
}
