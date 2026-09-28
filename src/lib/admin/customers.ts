import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const LOST = new Set(["cancelled", "refused"]);

export type CustomerRow = {
  id: string;
  name: string | null;
  phone: string;
  notes: string | null;
  flagged: boolean;
  refused_count: number;
  created_at: string;
  orders: number;
  spend: number;
  first_order: string | null;
  last_order: string | null;
  source: string | null;
};

/** Every customer with what they bought (cancelled and refused orders don't count as spend). */
export async function loadCustomers(supabase: SupabaseClient<Database>): Promise<CustomerRow[]> {
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, notes, flagged, refused_count, created_at, orders(total, status, created_at, utm_source, source)")
    .order("created_at", { ascending: false })
    .limit(5000);
  return (data ?? []).map((c) => {
    const kept = (c.orders ?? []).filter((o) => !LOST.has(o.status));
    const dates = (c.orders ?? []).map((o) => o.created_at).sort();
    const first = [...(c.orders ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      flagged: c.flagged,
      refused_count: c.refused_count,
      created_at: c.created_at,
      orders: kept.length,
      spend: kept.reduce((s, o) => s + Number(o.total), 0),
      first_order: dates[0] ?? null,
      last_order: dates.at(-1) ?? null,
      source: first ? (first.utm_source ?? (first.source === "web" ? "Direct" : first.source)) : null,
    };
  });
}
