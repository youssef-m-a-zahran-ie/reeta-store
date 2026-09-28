"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import type { Database } from "@/lib/supabase/database.types";

type Platform = Database["public"]["Enums"]["ad_platform"];
const PLATFORMS: Platform[] = ["meta", "tiktok", "google", "snapchat", "other"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath("/admin/ad-spend");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function saveAdSpend(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const platform = str(fd, "platform") as Platform;
    const start = str(fd, "period_start");
    const end = str(fd, "period_end") || start;
    const amount = num(fd, "amount");
    const errors: Record<string, string> = {};
    if (!PLATFORMS.includes(platform)) errors.platform = "Pick a platform.";
    if (!ISO.test(start)) errors.period_start = "Pick the first day.";
    if (!ISO.test(end) || end < start) errors.period_end = "The last day can't be before the first.";
    if (amount === null || Number.isNaN(amount) || amount <= 0) errors.amount = "Type the amount spent.";
    if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
    const { error } = await supabase.from("ad_spend").insert({
      platform,
      period_start: start,
      period_end: end,
      amount: Math.round(amount! * 100) / 100,
      campaign: optStr(fd, "campaign")?.slice(0, 120) ?? null,
      note: optStr(fd, "note")?.slice(0, 300) ?? null,
    });
    if (error) return fail(friendlyDbError(error));
    refresh();
    return ok("Saved. Reports now include it.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function deleteAdSpend(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("ad_spend").delete().eq("id", str(fd, "id"));
    if (error) return fail(friendlyDbError(error));
    refresh();
    return ok("Deleted.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
