"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { bool, num, optStr, str } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";
import type { Database } from "@/lib/supabase/database.types";

type SettingsUpdate = Database["public"]["Tables"]["settings"]["Update"];

async function save(update: SettingsUpdate, message: string): Promise<ActionState> {
  try {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("settings").update(update).eq("id", 1);
    if (error) return fail(friendlyDbError(error));
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    revalidatePath("/ar", "layout");
    return ok(message);
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}

export async function saveDelivery(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const lat = num(fd, "store_lat");
  const lng = num(fd, "store_lng");
  const perKm = num(fd, "fee_per_km");
  const min = num(fd, "min_shipping_fee");
  const factor = num(fd, "distance_factor");
  const round = num(fd, "fee_round_to");
  const errors: Record<string, string> = {};
  if (lat === null || Number.isNaN(lat) || lat < 21.5 || lat > 32) errors.store_lat = "Place the store pin on the map.";
  if (lng === null || Number.isNaN(lng) || lng < 24.5 || lng > 37) errors.store_lat = "Place the store pin on the map.";
  if (perKm === null || Number.isNaN(perKm) || perKm < 0) errors.fee_per_km = "Enter a price per km.";
  if (min === null || Number.isNaN(min) || min < 0) errors.min_shipping_fee = "Enter a minimum (0 is fine).";
  if (factor === null || Number.isNaN(factor) || factor < 1 || factor > 2.5) errors.distance_factor = "Use a number between 1 and 2.5.";
  if (round === null || Number.isNaN(round) || round < 1) errors.fee_round_to = "Use 1 or more.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  return save(
    { store_lat: lat, store_lng: lng, fee_per_km: perKm, min_shipping_fee: min!, distance_factor: factor!, fee_round_to: Math.round(round!) },
    "Delivery pricing saved. New checkouts use it right away.",
  );
}

export async function savePayments(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const link = optStr(fd, "instapay_link");
  if (link && !/^https:\/\/\S+$/.test(link)) return fail("The InstaPay link should start with https://", { instapay_link: "Starts with https://" });
  return save(
    { instapay_handle: optStr(fd, "instapay_handle"), instapay_name: optStr(fd, "instapay_name"), instapay_link: link },
    "Payment details saved.",
  );
}

export async function saveStore(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return save(
    {
      orders_paused: bool(fd, "orders_paused"),
      paused_message_en: optStr(fd, "paused_message_en"),
      paused_message_ar: optStr(fd, "paused_message_ar"),
      announcement_visible: bool(fd, "announcement_visible"),
      announcement_en: optStr(fd, "announcement_en"),
      announcement_ar: optStr(fd, "announcement_ar"),
    },
    bool(fd, "orders_paused") ? "Saved. The store isn't taking orders now." : "Saved.",
  );
}

export async function saveContact(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const url = (k: string) => {
    const v = optStr(fd, k);
    if (!v) return null;
    return /^https?:\/\//.test(v) ? v : `https://${v}`;
  };
  return save(
    {
      whatsapp_number: optStr(fd, "whatsapp_number"),
      whatsapp_button: bool(fd, "whatsapp_button"),
      instagram_url: url("instagram_url"),
      tiktok_url: url("tiktok_url"),
      facebook_url: url("facebook_url"),
    },
    "Contact details saved.",
  );
}

export async function saveNotifications(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emails = str(fd, "notify_emails")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const bad = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (bad) return fail(`“${bad}” isn't a valid email.`);
  return save({ notify_emails: emails }, "Saved.");
}

export async function saveTracking(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const meta = optStr(fd, "meta_pixel_id")?.replace(/\s/g, "") ?? null;
  const tiktok = optStr(fd, "tiktok_pixel_id")?.replace(/\s/g, "").toUpperCase() ?? null;
  const ga4 = optStr(fd, "ga4_id")?.replace(/\s/g, "").toUpperCase() ?? null;
  const errors: Record<string, string> = {};
  if (meta && !/^\d{8,20}$/.test(meta)) errors.meta_pixel_id = "A Meta Pixel ID is only numbers, like 1234567890123456.";
  if (tiktok && !/^[A-Z0-9]{10,30}$/.test(tiktok)) errors.tiktok_pixel_id = "A TikTok Pixel ID is letters and numbers, like CABC123DEF456GHI.";
  if (ga4 && !/^G-[A-Z0-9]{4,15}$/.test(ga4)) errors.ga4_id = "A Google Analytics ID starts with G-, like G-AB12CD34EF.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);
  return save({ meta_pixel_id: meta, tiktok_pixel_id: tiktok, ga4_id: ga4 }, "Saved. Tracking starts on the next page load.");
}
