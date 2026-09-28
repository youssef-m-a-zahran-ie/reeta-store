"use server";

import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

function db() {
  return createSupabase<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type CartRef = { kind: "variant" | "bundle"; id: string; qty: number };

export type QuoteLine = {
  kind: "variant" | "bundle";
  id: string;
  name_en: string;
  name_ar: string;
  label_en: string | null;
  label_ar: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  color: string | null;
};
export type QuoteError = { code: string; index?: number; id?: string; name_en?: string; name_ar?: string; min?: number };
export type Quote = {
  lines: QuoteLine[];
  errors: QuoteError[];
  subtotal: number;
  discount: { code: string; type: string; amount: number } | null;
  discount_total: number;
  free_shipping: boolean;
  distance_km: number | null;
  has_location: boolean;
  shipping_fee: number;
  total: number;
  orders_paused: boolean;
};

function cleanItems(items: CartRef[]) {
  return items
    .filter((i) => /^[0-9a-f-]{36}$/.test(i.id) && (i.kind === "variant" || i.kind === "bundle"))
    .slice(0, 50)
    .map((i) => ({ kind: i.kind, id: i.id, qty: Math.max(1, Math.min(20, Math.round(i.qty) || 1)) }));
}

/** Live prices, stock, discount and delivery for the checkout page. */
export async function getQuote(input: { items: CartRef[]; lat?: number | null; lng?: number | null; code?: string }): Promise<Quote | null> {
  const { data, error } = await db().rpc("store_quote", {
    p: {
      items: cleanItems(input.items),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      discount_code: (input.code ?? "").slice(0, 40),
    } as unknown as Json,
  });
  if (error || !data) return null;
  return data as unknown as Quote;
}

export type PlaceOrderInput = {
  items: CartRef[];
  name: string;
  phone: string;
  address_line: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  lat: number;
  lng: number;
  payment_method: "cod" | "instapay";
  discount_code?: string;
  note?: string;
  lang: "en" | "ar";
  website?: string;
  utm?: Record<string, string | undefined>;
};

export type PlaceOrderResult =
  | { ok: true; id: string; number: number }
  | { ok: false; code: string; errors?: QuoteError[] };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const utm = input.utm ?? {};
  const { data, error } = await db().rpc("place_order", {
    p: {
      items: cleanItems(input.items),
      name: input.name,
      phone: input.phone,
      address_line: input.address_line,
      building: input.building,
      floor: input.floor,
      apartment: input.apartment,
      landmark: input.landmark,
      lat: input.lat,
      lng: input.lng,
      payment_method: input.payment_method,
      discount_code: input.discount_code,
      note: input.note,
      lang: input.lang,
      website: input.website,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      referrer: utm.referrer,
    } as unknown as Json,
  });
  if (error) {
    if (error.message === "order_invalid") {
      let errors: QuoteError[] = [];
      try {
        errors = JSON.parse(error.details ?? "[]");
      } catch {
        // keep empty
      }
      return { ok: false, code: "order_invalid", errors };
    }
    return { ok: false, code: error.message || "generic" };
  }
  const res = data as unknown as { id: string; number: number };
  return { ok: true, id: res.id, number: res.number };
}

/** Saves a checkout once a phone number is typed, so the team can follow up if it isn't finished. */
export async function trackCheckout(input: { phone: string; name: string; cart: unknown[]; subtotal: number; utm?: Record<string, string | undefined> }) {
  await db().rpc("store_track_checkout", {
    p: {
      phone: input.phone,
      name: input.name,
      cart: input.cart.slice(0, 50),
      subtotal: input.subtotal,
      utm_source: input.utm?.utm_source,
      utm_medium: input.utm?.utm_medium,
      utm_campaign: input.utm?.utm_campaign,
    } as unknown as Json,
  });
}
