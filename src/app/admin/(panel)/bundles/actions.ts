"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { int, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import { slugify } from "@/lib/format";
import { MEDIA_BUCKET } from "@/lib/supabase/env";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function refresh(id?: string) {
  revalidatePath("/admin/bundles");
  if (id) revalidatePath(`/admin/bundles/${id}`);
  revalidatePath("/", "layout");
  revalidatePath("/ar", "layout");
}

async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function saveBundle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = optStr(fd, "id");
    const name_en = str(fd, "name_en");
    const name_ar = str(fd, "name_ar");
    const slug = str(fd, "slug") || slugify(name_en);
    const price = num(fd, "price");
    const status = str(fd, "status") as "draft" | "active" | "archived";
    let items: { variant_id: string; qty: number }[] = [];
    try {
      items = (JSON.parse(str(fd, "items") || "[]") as { variant_id: string; qty: number }[])
        .filter((i) => /^[0-9a-f-]{36}$/.test(i.variant_id))
        .map((i) => ({ variant_id: i.variant_id, qty: Math.max(1, Math.min(20, Math.round(i.qty) || 1)) }));
    } catch {
      items = [];
    }
    const merged = new Map<string, number>();
    items.forEach((i) => merged.set(i.variant_id, (merged.get(i.variant_id) ?? 0) + i.qty));

    const errors: Record<string, string> = {};
    if (!name_en) errors.name_en = "Add the English name.";
    if (!name_ar) errors.name_ar = "Add the Arabic name.";
    if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
    if (price === null || Number.isNaN(price) || price <= 0) errors.price = "Enter the box price.";
    if (!["draft", "active", "archived"].includes(status)) errors.status = "Pick a status.";
    if (status === "active" && merged.size === 0) errors.items = "Add at least one product before making it active.";
    if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);

    const row = {
      name_en,
      name_ar,
      slug,
      price: price!,
      status,
      description_en: optStr(fd, "description_en"),
      description_ar: optStr(fd, "description_ar"),
      sort: int(fd, "sort"),
    };
    let bundleId = id;
    if (id) {
      const { error } = await supabase.from("bundles").update(row).eq("id", id);
      if (error) return fail(friendlyDbError(error));
    } else {
      const { data, error } = await supabase.from("bundles").insert(row).select("id").single();
      if (error || !data) return fail(friendlyDbError(error));
      bundleId = data.id;
    }

    const { error: delErr } = await supabase.from("bundle_items").delete().eq("bundle_id", bundleId!);
    if (delErr) return fail(friendlyDbError(delErr));
    if (merged.size) {
      const { error } = await supabase
        .from("bundle_items")
        .insert([...merged].map(([variant_id, qty]) => ({ bundle_id: bundleId!, variant_id, qty })));
      if (error) return fail(friendlyDbError(error));
    }
    refresh(bundleId!);
    if (!id) redirect(`/admin/bundles/${bundleId}?created=1`);
    return ok(status === "active" ? "Saved. It's live on the store." : "Saved.");
  });
}

export async function deleteBundle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("bundle_id", id);
    if (count) return fail("This box has orders, so it stays for your reports. Archive it instead.");
    const { data: imgs } = await supabase.from("bundle_images").select("path").eq("bundle_id", id);
    const { error } = await supabase.from("bundles").delete().eq("id", id);
    if (error) return fail(friendlyDbError(error));
    if (imgs?.length) await supabase.storage.from(MEDIA_BUCKET).remove(imgs.map((i) => i.path));
    refresh();
    redirect("/admin/bundles?deleted=1");
  });
}

export async function addBundleImages(bundleId: string, paths: string[]): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const valid = paths.filter((p) => p.startsWith(`bundles/${bundleId}/`));
    if (!valid.length) return fail("Nothing to add.");
    const { data: last } = await supabase.from("bundle_images").select("sort").eq("bundle_id", bundleId).order("sort", { ascending: false }).limit(1).maybeSingle();
    const start = (last?.sort ?? -1) + 1;
    const { error } = await supabase.from("bundle_images").insert(valid.map((path, i) => ({ bundle_id: bundleId, path, sort: start + i })));
    if (error) return fail(friendlyDbError(error));
    refresh(bundleId);
    return ok(`${valid.length} photo${valid.length === 1 ? "" : "s"} added.`);
  });
}

export async function updateBundleImages(bundleId: string, images: { id: string; alt_en: string; alt_ar: string }[]): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    for (const [i, img] of images.entries()) {
      const { error } = await supabase
        .from("bundle_images")
        .update({ sort: i, alt_en: img.alt_en || null, alt_ar: img.alt_ar || null })
        .eq("id", img.id)
        .eq("bundle_id", bundleId);
      if (error) return fail(friendlyDbError(error));
    }
    refresh(bundleId);
    return ok("Photos saved.");
  });
}

export async function deleteBundleImage(bundleId: string, imageId: string): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { data: img } = await supabase.from("bundle_images").select("path").eq("id", imageId).eq("bundle_id", bundleId).single();
    if (!img) return fail("That photo is already gone.");
    const { error } = await supabase.from("bundle_images").delete().eq("id", imageId);
    if (error) return fail(friendlyDbError(error));
    await supabase.storage.from(MEDIA_BUCKET).remove([img.path]);
    refresh(bundleId);
    return ok("Photo removed.");
  });
}
