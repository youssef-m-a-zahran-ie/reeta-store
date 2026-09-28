import "server-only";
import type { getAdmin } from "./guard";

type Supa = NonNullable<Awaited<ReturnType<typeof getAdmin>>>["supabase"];

export type Report = {
  from: string;
  to: string;
  prev_from: string;
  prev_to: string;
  kpi: {
    sales: number; orders: number; aov: number; profit: number; profit_complete: boolean; delivery: number; discounts: number;
    cancelled: number; refused: number; all_orders: number; returning: number; customers: number;
  };
  prev: { sales: number; orders: number; aov: number; profit: number; returning: number; refused: number; all_orders: number };
  daily: { d: string; sales: number; orders: number }[];
  sources: { source: string; platform: string | null; orders: number; sales: number; profit: number }[];
  spend: { platform: string; amount: number; sales: number; orders: number }[];
  spend_prev: number;
  products: { name: string; label: string | null; bundle: boolean; qty: number; sales: number; profit: number; grams: number }[];
  discounts: { code: string; orders: number; sales: number; given: number }[];
  hours: { dow: number; hour: number; orders: number }[];
  distances: { bucket: string; orders: number; avg_fee: number; sales: number }[];
  payments: { method: "cod" | "instapay"; orders: number; sales: number }[];
  abandoned: { total: number; recovered: number; value: number };
};

export async function loadReport(supabase: Supa, from: string, to: string): Promise<Report | null> {
  const { data, error } = await supabase.rpc("admin_report", { p_from: from, p_to: to });
  if (error || !data) return null;
  return data as unknown as Report;
}

export { PLATFORM_LABELS as PLATFORM_LABEL } from "@/app/admin/(panel)/ad-spend/labels";

export function sourceLabel(s: string) {
  const map: Record<string, string> = {
    direct: "Direct (no link)",
    whatsapp: "WhatsApp (added by team)",
    instagram: "Instagram",
    phone: "Phone (added by team)",
    other: "Other (added by team)",
    facebook: "Facebook",
    fb: "Facebook",
    ig: "Instagram",
    tiktok: "TikTok",
    google: "Google",
    meta: "Meta ads",
  };
  return map[s] ?? s;
}
