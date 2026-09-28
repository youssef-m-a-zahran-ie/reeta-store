"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, NotAdminError } from "@/lib/admin/guard";
import type { Json } from "@/lib/supabase/database.types";

export type ManualItem = { kind: "variant" | "bundle"; id: string; qty: number };

export type ManualInput = {
  items: ManualItem[];
  name: string;
  phone: string;
  address_line: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  shipping_fee: string;
  discount_code: string;
  payment_method: "cod" | "instapay";
  paid: boolean;
  status: "new" | "confirmed";
  source: "whatsapp" | "instagram" | "phone" | "other";
  lang: "en" | "ar";
  allow_short_stock: boolean;
  note: string;
  internal_note: string;
};

export type AdminQuote = {
  lines: { kind: string; id: string; name_en: string; label_en: string | null; qty: number; unit_price: number; unit_cost: number | null; line_total: number }[];
  errors: { code: string; index?: number; name_en?: string; min?: number }[];
  short_stock?: { name_en: string }[];
  subtotal: number;
  discount: { code: string; amount: number } | null;
  discount_total: number;
  free_shipping: boolean;
  distance_km: number | null;
  shipping_fee: number;
  fee_overridden?: boolean;
  total: number;
};

function clean(input: Partial<ManualInput>) {
  const items = (input.items ?? [])
    .filter((i) => /^[0-9a-f-]{36}$/.test(i.id) && (i.kind === "variant" || i.kind === "bundle"))
    .slice(0, 50)
    .map((i) => ({ kind: i.kind, id: i.id, qty: Math.max(1, Math.min(20, Math.round(i.qty) || 1)) }));
  const fee = (input.shipping_fee ?? "").trim();
  return {
    ...input,
    items,
    shipping_fee: fee !== "" && Number.isFinite(Number(fee)) ? String(Math.max(0, Number(fee))) : "",
    discount_code: (input.discount_code ?? "").slice(0, 40),
    lat: typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null,
    lng: typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null,
  };
}

export async function adminQuote(input: Partial<ManualInput>): Promise<AdminQuote | null> {
  try {
    const { supabase } = await assertAdmin();
    const { data, error } = await supabase.rpc("admin_quote", { p: clean(input) as unknown as Json });
    if (error || !data) return null;
    return data as unknown as AdminQuote;
  } catch (e) {
    if (e instanceof NotAdminError) return null;
    throw e;
  }
}

const MESSAGES: Record<string, string> = {
  invalid_name: "Add the customer's name.",
  invalid_phone: "That phone number doesn't look Egyptian (01…).",
  invalid_address: "Add the address.",
  invalid_location: "The location doesn't look right. Paste the coordinates again or leave it empty.",
  needs_fee: "No location, so type the delivery fee.",
  invalid_payment: "Pick how they pay.",
  invalid_source: "Pick where the order came from.",
  not_admin: "Your session ended. Sign in again.",
};

export async function createManualOrder(
  input: ManualInput,
): Promise<{ ok: true; id: string; number: number } | { ok: false; message: string }> {
  try {
    const { supabase } = await assertAdmin();
    const { data, error } = await supabase.rpc("admin_place_order", { p: clean(input) as unknown as Json });
    if (error) {
      if (error.message === "order_invalid") {
        let errs: { code: string; name_en?: string; min?: number }[] = [];
        try {
          errs = JSON.parse(error.details ?? "[]");
        } catch {
          // ignore
        }
        const first = errs[0];
        const text =
          first?.code === "out_of_stock"
            ? `Not enough ${first.name_en} in stock. Tick “sell anyway” if it's on the shelf.`
            : first?.code === "invalid_code"
              ? "That discount code isn't active."
              : first?.code === "code_min"
                ? `That code needs a subtotal of at least ${first.min} EGP.`
                : first?.code === "empty"
                  ? "Add at least one item."
                  : "One of the items can't be sold right now (draft, hidden or no price).";
        return { ok: false, message: text };
      }
      return { ok: false, message: MESSAGES[error.message] ?? error.message };
    }
    const res = data as unknown as { id: string; number: number };
    revalidatePath("/admin/orders");
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    return { ok: true, id: res.id, number: res.number };
  } catch (e) {
    if (e instanceof NotAdminError) return { ok: false, message: e.message };
    throw e;
  }
}
