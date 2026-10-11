"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, int, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { grams as gramsLabel } from "@/lib/format";
import { slugify } from "@/lib/format";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { isBaseVisual, isCoatingVisual } from "@/store/menu/visuals";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

function refresh() {
  revalidatePath("/admin/menu", "layout");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
}

/* ---------- On / off ---------- */
export const saveMenuSwitch = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const on = bool(fd, "custom_enabled");
  const { error } = await supabase.from("settings").update({ custom_enabled: on }).eq("id", 1);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(on ? "Selling is on. The menu shows once at least one nut, sauce and size are priced." : "Selling is off. The menu is hidden from the store.");
});

/* ---------- Prices and weights ----------
   Fields: bp:<base>:<size>:grams|price|cost and cp:<coating>:<size>:price|cost */
export const saveMenuPrices = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  type BaseRow = { base_id: string; size_id: string; grams: number | null; price: number | null; cost: number | null };
  type CoatRow = { coating_id: string; size_id: string; price: number | null; cost: number | null };
  const baseRows = new Map<string, BaseRow>();
  const coatRows = new Map<string, CoatRow>();
  const errors: Record<string, string> = {};
  const re = new RegExp(`^(bp|cp):(${UUID}):(${UUID}):(grams|price|cost)$`);

  for (const [key, raw] of fd.entries()) {
    const m = re.exec(key);
    if (!m) continue;
    const [, kind, owner, size_id, field] = m;
    const v = typeof raw === "string" ? raw.trim() : "";
    const n = v === "" ? null : Number(v);
    if (n !== null && (!Number.isFinite(n) || n < 0 || (field === "grams" && n === 0))) {
      errors[key] = field === "grams" ? "Above zero." : "Use a number.";
      continue;
    }
    if (kind === "bp") {
      const k = `${owner}:${size_id}`;
      const row = baseRows.get(k) ?? { base_id: owner, size_id, grams: null, price: null, cost: null };
      row[field as "grams" | "price" | "cost"] = n;
      baseRows.set(k, row);
    } else if (field !== "grams") {
      const k = `${owner}:${size_id}`;
      const row = coatRows.get(k) ?? { coating_id: owner, size_id, price: null, cost: null };
      row[field as "price" | "cost"] = n;
      coatRows.set(k, row);
    }
  }
  if (Object.keys(errors).length) return fail("Some cells aren't valid numbers. Fix them and save again.", errors);

  const half = [...baseRows.values()].filter((r) => (r.price === null) !== (r.grams === null));
  if (half.length) return fail("Each nut size needs both a weight and a price (or leave both empty to hide that size).");

  if (baseRows.size) {
    const { error } = await supabase.from("custom_base_prices").upsert([...baseRows.values()]);
    if (error) return fail(friendlyDbError(error));
  }
  if (coatRows.size) {
    const { error } = await supabase.from("custom_coating_prices").upsert([...coatRows.values()]);
    if (error) return fail(friendlyDbError(error));
  }
  refresh();
  return ok("Saved. The menu shows the new prices right away.");
});

/* ---------- Nuts on the menu ---------- */
export const addMenuBase = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const base_id = str(fd, "base_id");
  const visual = str(fd, "visual");
  if (!base_id) return fail("Pick a nut.", { base_id: "Pick a nut." });
  if (!isBaseVisual(visual)) return fail("Pick its drawing.", { visual: "Pick the drawing." });
  const { error } = await supabase.from("custom_bases").insert({ base_id, visual, sort: int(fd, "sort", 10) });
  if (error) return fail(error.code === "23505" ? "This nut is already on the menu." : friendlyDbError(error));
  const { data: sizes } = await supabase.from("custom_sizes").select("id");
  if (sizes?.length) await supabase.from("custom_base_prices").upsert(sizes.map((s) => ({ base_id, size_id: s.id })), { ignoreDuplicates: true });
  refresh();
  return ok("Added. Set its weights and prices on the Prices tab.");
});

export const saveMenuBase = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const base_id = str(fd, "base_id");
  const visual = str(fd, "visual");
  const display = str(fd, "display") === "size" ? "size" : "weight";
  const share = num(fd, "coating_share");
  const errors: Record<string, string> = {};
  if (!isBaseVisual(visual)) errors.visual = "Pick the drawing.";
  if (share === null || Number.isNaN(share) || share < 0 || share > 90) errors.coating_share = "Between 0 and 90.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const { error } = await supabase
    .from("custom_bases")
    .update({
      visual,
      display,
      coating_share: share!,
      note_en: optStr(fd, "note_en"),
      note_ar: optStr(fd, "note_ar"),
      sort: int(fd, "sort"),
      is_active: bool(fd, "is_active"),
    })
    .eq("base_id", base_id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok("Saved.");
});

export const removeMenuBase = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { error } = await supabase.from("custom_bases").delete().eq("base_id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok("Removed from the menu. Past orders keep their details.");
});

/* ---------- Sauces on the menu ---------- */
export const addMenuCoating = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const coating_id = str(fd, "coating_id");
  const visual = str(fd, "visual");
  if (!coating_id) return fail("Pick a coating.", { coating_id: "Pick a coating." });
  if (!isCoatingVisual(visual)) return fail("Pick its color family.", { visual: "Pick one." });
  const { error } = await supabase.from("custom_coatings").insert({ coating_id, visual, sort: int(fd, "sort", 10) });
  if (error) return fail(error.code === "23505" ? "This sauce is already on the menu." : friendlyDbError(error));
  const { data: sizes } = await supabase.from("custom_sizes").select("id");
  if (sizes?.length) await supabase.from("custom_coating_prices").upsert(sizes.map((s) => ({ coating_id, size_id: s.id })), { ignoreDuplicates: true });
  refresh();
  return ok("Added. Set its prices on the Prices tab.");
});

export const saveMenuCoating = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const coating_id = str(fd, "coating_id");
  const visual = str(fd, "visual");
  if (!isCoatingVisual(visual)) return fail("Pick its color family.", { visual: "Pick one." });
  const { error } = await supabase
    .from("custom_coatings")
    .update({
      visual,
      label_en: optStr(fd, "label_en"),
      label_ar: optStr(fd, "label_ar"),
      note_en: optStr(fd, "note_en"),
      note_ar: optStr(fd, "note_ar"),
      sort: int(fd, "sort"),
      is_active: bool(fd, "is_active"),
    })
    .eq("coating_id", coating_id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok("Saved.");
});

export const removeMenuCoating = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("custom_coatings").delete().eq("coating_id", str(fd, "id"));
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok("Removed from the menu. Past orders keep their details.");
});

/* ---------- Plate photos ----------
   The plain plate lives on custom_bases.image_path; the plate with each sauce in custom_plate_photos.
   The browser uploads to storage (menu/<uuid>.webp) and then calls this to link it. */
const PHOTO_RE = /^menu\/[0-9a-f-]{36}\.webp$/;
const UUID_RE = new RegExp(`^${UUID}$`);

export async function setPlatePhoto(baseId: string, coatingId: string | null, path: string): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(baseId) || (coatingId !== null && !UUID_RE.test(coatingId)) || !PHOTO_RE.test(path)) return fail("That upload didn't work. Try again.");
    let old: string | null = null;
    if (coatingId) {
      const { data: prev } = await supabase.from("custom_plate_photos").select("image_path").eq("base_id", baseId).eq("coating_id", coatingId).maybeSingle();
      old = prev?.image_path ?? null;
      const { error } = await supabase.from("custom_plate_photos").upsert({ base_id: baseId, coating_id: coatingId, image_path: path });
      if (error) return fail(friendlyDbError(error));
    } else {
      const { data: prev } = await supabase.from("custom_bases").select("image_path").eq("base_id", baseId).maybeSingle();
      old = prev?.image_path ?? null;
      const { error } = await supabase.from("custom_bases").update({ image_path: path }).eq("base_id", baseId);
      if (error) return fail(friendlyDbError(error));
    }
    if (old && old !== path) await supabase.storage.from(MEDIA_BUCKET).remove([old]);
    refresh();
    return ok("Photo saved. It's live on the menu.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function removePlatePhoto(baseId: string, coatingId: string | null): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(baseId) || (coatingId !== null && !UUID_RE.test(coatingId))) return fail("Not found.");
    let old: string | null = null;
    if (coatingId) {
      const { data } = await supabase.from("custom_plate_photos").delete().eq("base_id", baseId).eq("coating_id", coatingId).select("image_path");
      old = data?.[0]?.image_path ?? null;
    } else {
      const { data: prev } = await supabase.from("custom_bases").select("image_path").eq("base_id", baseId).maybeSingle();
      old = prev?.image_path ?? null;
      const { error } = await supabase.from("custom_bases").update({ image_path: null }).eq("base_id", baseId);
      if (error) return fail(friendlyDbError(error));
    }
    if (old) await supabase.storage.from(MEDIA_BUCKET).remove([old]);
    refresh();
    return ok("Photo removed.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

/* ---------- Sizes ---------- */
export const saveMenuSize = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = optStr(fd, "id");
  const name_en = str(fd, "name_en");
  const name_ar = str(fd, "name_ar");
  const slug = str(fd, "slug") || slugify(name_en);
  const tier = int(fd, "tier", 2);
  const errors: Record<string, string> = {};
  if (!name_en) errors.name_en = "Add the English name.";
  if (!name_ar) errors.name_ar = "Add the Arabic name.";
  if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
  if (![1, 2, 3].includes(tier)) errors.tier = "Pick a plate size.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  const row = { name_en, name_ar, slug, tier, sort: int(fd, "sort"), is_active: bool(fd, "is_active") };

  if (id) {
    const { error } = await supabase.from("custom_sizes").update(row).eq("id", id);
    if (error) return fail(friendlyDbError(error));
    refresh();
    return ok("Saved.");
  }
  const { data: created, error } = await supabase.from("custom_sizes").insert(row).select("id").single();
  if (error || !created) return fail(friendlyDbError(error));
  const [{ data: bases }, { data: coatings }] = await Promise.all([
    supabase.from("custom_bases").select("base_id"),
    supabase.from("custom_coatings").select("coating_id"),
  ]);
  if (bases?.length) await supabase.from("custom_base_prices").insert(bases.map((b) => ({ base_id: b.base_id, size_id: created.id })));
  if (coatings?.length) await supabase.from("custom_coating_prices").insert(coatings.map((c) => ({ coating_id: c.coating_id, size_id: created.id })));
  refresh();
  return ok(`Added ${name_en}. Set its weights and prices on the Prices tab.`);
});

export const deleteMenuSize = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const id = str(fd, "id");
  const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("custom_size_id", id);
  if (count) return fail("This size has been ordered before. Switch it off instead, so old orders keep it.");
  const { error } = await supabase.from("custom_sizes").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok("Deleted.");
});

/* ---------- Ingredient stock (Inventory page) ----------
   mode: "add" (new batch), "remove" (waste, samples), "set" (after a count). */
export const changeIngredientStock = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const kind = str(fd, "kind") === "coating" ? "coating" : "base";
  const id = str(fd, "id");
  const mode = str(fd, "mode");
  const amount = num(fd, "amount");
  const note = optStr(fd, "note");
  if (amount === null || Number.isNaN(amount) || amount < 0) return fail("Enter an amount.", { amount: "Enter an amount." });
  if (mode !== "set" && amount === 0) return fail("Enter an amount above zero.", { amount: "Above zero." });

  const row =
    kind === "base"
      ? (await supabase.from("custom_bases").select("stock_grams, bases(name_en)").eq("base_id", id).single()).data
      : (await supabase.from("custom_coatings").select("stock_grams, coatings(name_en)").eq("coating_id", id).single()).data;
  if (!row) return fail("Not found.");
  const name = "bases" in row ? row.bases?.name_en : "coatings" in row ? row.coatings?.name_en : "";
  const current = row.stock_grams;
  const delta = mode === "add" ? amount : mode === "remove" ? -amount : amount - current;
  if (delta === 0) return ok("Stock already matches. Nothing changed.");
  if (mode === "remove" && current + delta < 0) return fail(`You can't remove more than what's in stock (${gramsLabel(current)}).`);

  const { error } = await supabase.from("stock_movements").insert({
    base_id: kind === "base" ? id : null,
    coating_id: kind === "coating" ? id : null,
    delta,
    reason: mode === "add" ? "batch" : "adjustment",
    note: note ?? (mode === "set" ? "Stock count" : mode === "remove" ? "Removed" : null),
  });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(`${name}: now ${gramsLabel(current + delta)}.`);
});

export const saveIngredientTracking = wrap(async (fd) => {
  const { supabase } = await assertAdmin();
  const kind = str(fd, "kind") === "coating" ? "coating" : "base";
  const id = str(fd, "id");
  const low = num(fd, "low_stock_threshold");
  if (low === null || Number.isNaN(low) || low < 0) return fail("Enter a warning level in grams.", { low_stock_threshold: "Grams." });
  const patch = { track_stock: bool(fd, "track_stock"), low_stock_threshold: low };
  const { error } =
    kind === "base"
      ? await supabase.from("custom_bases").update(patch).eq("base_id", id)
      : await supabase.from("custom_coatings").update(patch).eq("coating_id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(patch.track_stock ? "Saved. Sizes that need more than what's in stock now show as sold out." : "Saved. Orders still record what they use, but never sell out.");
});
