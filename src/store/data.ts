import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export type Img = { path: string; alt_en: string | null; alt_ar: string | null };
export type StoreVariant = {
  id: string;
  label_en: string;
  label_ar: string;
  amount: number | null;
  price: number;
  available: boolean;
  sort: number;
};
export type StoreProduct = {
  id: string;
  slug: string;
  category_id: string;
  category_slug: string;
  name_en: string;
  name_ar: string;
  short_en: string | null;
  short_ar: string | null;
  base_slug: string | null;
  coating_slug: string | null;
  color: string | null;
  is_featured: boolean;
  sort: number;
  created_at: string;
  images: Img[];
  variants: StoreVariant[];
};
export type StoreProductFull = StoreProduct & {
  description_en: string | null;
  description_ar: string | null;
  ingredients_en: string | null;
  ingredients_ar: string | null;
  allergens_en: string | null;
  allergens_ar: string | null;
  storage_en: string | null;
  storage_ar: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category_name_en: string;
  category_name_ar: string;
  base_name_en: string | null;
  base_name_ar: string | null;
  coating_name_en: string | null;
  coating_name_ar: string | null;
};
export type StoreCategory = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  image_path: string | null;
};
export type Facet = { slug: string; name_en: string; name_ar: string; color?: string };
export type Catalog = { categories: StoreCategory[]; bases: Facet[]; coatings: Facet[]; products: StoreProduct[] };
export type StoreBundle = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price: number;
  separate_price: number | null;
  available: boolean;
  images: Img[];
  items: { product_slug: string; name_en: string; name_ar: string; color: string | null; label_en: string | null; label_ar: string | null; qty: number }[];
};
export type StoreSettings = {
  whatsapp_number: string | null;
  whatsapp_button: boolean;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  meta_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  ga4_id: string | null;
  orders_paused: boolean;
  paused_message_en: string | null;
  paused_message_ar: string | null;
  announcement_en: string | null;
  announcement_ar: string | null;
  announcement_visible: boolean;
  build_box_enabled: boolean;
  seo_title: string | null;
  seo_description: string | null;
  free_shipping_over: number | null;
};
export type ContentBlock = { key: string; sort: number; data: Record<string, unknown> };

/** Anonymous client: shoppers only ever see what RLS and the store functions allow. */
function db() {
  return createSupabase<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const EMPTY_SETTINGS: StoreSettings = {
  whatsapp_number: null,
  whatsapp_button: false,
  instagram_url: null,
  tiktok_url: null,
  facebook_url: null,
  meta_pixel_id: null,
  tiktok_pixel_id: null,
  ga4_id: null,
  orders_paused: false,
  paused_message_en: null,
  paused_message_ar: null,
  announcement_en: null,
  announcement_ar: null,
  announcement_visible: false,
  build_box_enabled: false,
  seo_title: null,
  seo_description: null,
  free_shipping_over: null,
};

// Pages read live data on every request so admin changes show up right away.
export const getCatalog = cache(async (): Promise<Catalog> => {
  await connection();
  const { data, error } = await db().rpc("store_catalog");
  if (error || !data) return { categories: [], bases: [], coatings: [], products: [] };
  return data as unknown as Catalog;
});

export const getProduct = cache(async (slug: string): Promise<StoreProductFull | null> => {
  await connection();
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const { data } = await db().rpc("store_product", { p_slug: slug });
  return (data as unknown as StoreProductFull) ?? null;
});

export const getBundles = cache(async (): Promise<StoreBundle[]> => {
  await connection();
  const { data } = await db().rpc("store_bundles");
  return (data as unknown as StoreBundle[]) ?? [];
});

export const getSettings = cache(async (): Promise<StoreSettings> => {
  await connection();
  const { data } = await db().rpc("store_settings");
  return { ...EMPTY_SETTINGS, ...((data as unknown as Partial<StoreSettings>) ?? {}) };
});

export const getContent = cache(async (page: string): Promise<Record<string, ContentBlock>> => {
  await connection();
  const { data } = await db().from("content_blocks").select("key, sort, data").eq("page", page).order("sort");
  const out: Record<string, ContentBlock> = {};
  for (const b of data ?? []) out[b.key] = { key: b.key, sort: b.sort, data: (b.data ?? {}) as Record<string, unknown> };
  return out;
});

export const getPage = cache(async (slug: string) => {
  await connection();
  const { data } = await db().from("pages").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export const getPublishedPages = cache(async () => {
  await connection();
  const { data } = await db().from("pages").select("slug, title_en, title_ar").neq("slug", "about").order("slug");
  return data ?? [];
});

export const getFaqs = cache(async () => {
  await connection();
  const { data } = await db().from("faqs").select("*").order("sort");
  return data ?? [];
});

export const getTestimonials = cache(async () => {
  await connection();
  const { data } = await db().from("testimonials").select("*").order("sort");
  return data ?? [];
});

/** Lowest price among available sizes (or all sizes if everything is sold out). */
export function fromPrice(p: StoreProduct) {
  const avail = p.variants.filter((v) => v.available);
  const list = avail.length ? avail : p.variants;
  return list.length ? Math.min(...list.map((v) => v.price)) : null;
}

export function inStock(p: StoreProduct) {
  return p.variants.some((v) => v.available);
}

export type StoreOrder = {
  id: string;
  number: number;
  created_at: string;
  status: string;
  payment_method: "cod" | "instapay";
  payment_status: "paid" | "unpaid";
  customer_name: string;
  phone: string;
  address_line: string;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  subtotal: number;
  discount_total: number;
  shipping_fee: number;
  total: number;
  discount_code: string | null;
  items: { id: string | null; name_en: string; name_ar: string; label: string | null; qty: number; unit_price: number; line_total: number }[];
  instapay_handle: string | null;
  instapay_name: string | null;
  instapay_link: string | null;
  whatsapp_number: string | null;
};

export async function getOrder(id: string): Promise<StoreOrder | null> {
  await connection();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().rpc("store_order", { p_id: id });
  return (data as unknown as StoreOrder) ?? null;
}
