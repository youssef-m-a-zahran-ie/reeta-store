"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import { num } from "@/lib/admin/form";
import { fail, friendlyDbError, ok, type ActionState } from "@/lib/admin/state";

export async function saveDelivery(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const lat = num(fd, "store_lat");
  const lng = num(fd, "store_lng");
  const perKm = num(fd, "fee_per_km");
  const min = num(fd, "min_shipping_fee");
  const max = num(fd, "max_shipping_fee");
  const maxKm = num(fd, "max_delivery_km");
  const factor = num(fd, "distance_factor");
  const round = num(fd, "fee_round_to");
  const bad = (v: number | null) => v === null || Number.isNaN(v);
  const errors: Record<string, string> = {};
  if (bad(lat) || lat! < 21.5 || lat! > 32) errors.store_lat = "Place the store pin on the map.";
  if (bad(lng) || lng! < 24.5 || lng! > 37) errors.store_lat = "Place the store pin on the map.";
  if (bad(perKm) || perKm! <= 0) errors.fee_per_km = "Enter a price per km.";
  if (bad(min) || min! < 0) errors.min_shipping_fee = "Enter a minimum (0 is fine).";
  if (max !== null && (Number.isNaN(max) || max < (min ?? 0))) errors.max_shipping_fee = "Use a number at or above the minimum, or leave empty for no cap.";
  if (maxKm !== null && (Number.isNaN(maxKm) || maxKm <= 0 || maxKm > 500)) errors.max_delivery_km = "Use a distance between 1 and 500 km, or leave empty for no limit.";
  if (bad(factor) || factor! < 1 || factor! > 2.5) errors.distance_factor = "Use a number between 1 and 2.5.";
  if (bad(round) || round! < 1) errors.fee_round_to = "Use 1 or more.";
  if (Object.keys(errors).length) return fail("Check the highlighted fields.", errors);

  try {
    const { supabase } = await assertAdmin();
    const { error } = await supabase
      .from("settings")
      .update({
        store_lat: lat,
        store_lng: lng,
        fee_per_km: perKm,
        min_shipping_fee: min!,
        max_shipping_fee: max,
        max_delivery_km: maxKm,
        distance_factor: factor!,
        fee_round_to: Math.round(round!),
      })
      .eq("id", 1);
    if (error) return fail(friendlyDbError(error));
    revalidatePath("/admin/delivery");
    return ok("Delivery pricing saved. New checkouts use it right away.");
  } catch (e) {
    if (e instanceof NotAdminError) return fail(e.message);
    throw e;
  }
}
