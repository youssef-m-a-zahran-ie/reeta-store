"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, int, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import type { Json } from "@/lib/supabase/database.types";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { HOME_BLOCKS } from "./schema";

async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

function refreshStore() {
  revalidatePath("/", "layout");
  revalidatePath("/ar", "layout");
  revalidatePath("/admin/content", "layout");
}

const clip = (s: string, n: number) => s.slice(0, n);

/* ---------- Home sections ---------- */
export async function saveBlock(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const def = HOME_BLOCKS.find((b) => b.key === str(fd, "key"));
    if (!def) return fail("Unknown section.");
    const data: Record<string, Json> = {};
    for (const f of def.fields) {
      for (const lang of ["en", "ar"]) data[`${f.name}_${lang}`] = clip(str(fd, `${f.name}_${lang}`), f.long ? 400 : 120);
    }
    if (def.points) {
      data.points = Array.from({ length: def.points }, (_, i) => ({
        title_en: clip(str(fd, `p${i}_title_en`), 80),
        title_ar: clip(str(fd, `p${i}_title_ar`), 80),
        text_en: clip(str(fd, `p${i}_text_en`), 240),
        text_ar: clip(str(fd, `p${i}_text_ar`), 240),
      })).filter((p) => p.title_en || p.title_ar);
    }
    const { error } = await supabase
      .from("content_blocks")
      .upsert({ key: def.key, page: "home", data, sort: int(fd, "sort", 0), is_visible: def.alwaysOn ? true : bool(fd, "is_visible") });
    if (error) return fail(friendlyDbError(error));
    refreshStore();
    return ok("Saved. The home page is updated.");
  });
}

/* ---------- Pages (About and policies) ---------- */
export async function savePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const slug = str(fd, "slug");
    const title_en = clip(str(fd, "title_en"), 120);
    const title_ar = clip(str(fd, "title_ar"), 120);
    const body_en = clip(str(fd, "body_en"), 20000);
    const body_ar = clip(str(fd, "body_ar"), 20000);
    const is_published = bool(fd, "is_published");
    if (!title_en || !title_ar) return fail("Add the title in both languages.");
    if (is_published && (!body_en || !body_ar)) return fail("Write the page in both languages before publishing it.");
    const { error } = await supabase.from("pages").update({ title_en, title_ar, body_en, body_ar, is_published }).eq("slug", slug);
    if (error) return fail(friendlyDbError(error));
    refreshStore();
    revalidatePath("/sitemap.xml");
    return ok(is_published ? "Saved and live." : "Saved as a draft (hidden from the store).");
  });
}

/* ---------- FAQ ---------- */
export async function saveFaq(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const row = {
      question_en: clip(str(fd, "question_en"), 200),
      question_ar: clip(str(fd, "question_ar"), 200),
      answer_en: clip(str(fd, "answer_en"), 1500),
      answer_ar: clip(str(fd, "answer_ar"), 1500),
      sort: int(fd, "sort", 0),
      is_visible: bool(fd, "is_visible"),
    };
    if (!row.question_en || !row.question_ar || !row.answer_en || !row.answer_ar) return fail("Fill the question and answer in both languages.");
    const { error } = id ? await supabase.from("faqs").update(row).eq("id", id) : await supabase.from("faqs").insert(row);
    if (error) return fail(friendlyDbError(error));
    refreshStore();
    return ok(id ? "Saved." : "Question added.");
  });
}

export async function deleteFaq(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("faqs").delete().eq("id", str(fd, "id"));
    if (error) return fail(friendlyDbError(error));
    refreshStore();
    return ok("Deleted.");
  });
}

/* ---------- Reviews ---------- */
export async function saveReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const image = str(fd, "image_path");
    const row = {
      name: clip(str(fd, "name"), 80) || null,
      text_en: clip(str(fd, "text_en"), 600) || null,
      text_ar: clip(str(fd, "text_ar"), 600) || null,
      image_path: /^reviews\/[0-9a-f-]{36}\.webp$/.test(image) ? image : null,
      sort: int(fd, "sort", 0),
      is_visible: bool(fd, "is_visible"),
    };
    if (!row.text_en && !row.text_ar && !row.image_path) return fail("Add the review text or a screenshot of it.");
    const { error } = id ? await supabase.from("testimonials").update(row).eq("id", id) : await supabase.from("testimonials").insert(row);
    if (error) return fail(friendlyDbError(error));
    refreshStore();
    return ok(id ? "Saved." : "Review added.");
  });
}

export async function deleteReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const { supabase } = await assertAdmin();
    const id = str(fd, "id");
    const { data: row } = await supabase.from("testimonials").select("image_path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) return fail(friendlyDbError(error));
    if (row?.image_path) await supabase.storage.from(MEDIA_BUCKET).remove([row.image_path]);
    refreshStore();
    return ok("Deleted.");
  });
}
