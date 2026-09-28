import "server-only";
import type { getAdmin } from "@/lib/admin/guard";
import type { VariantOption } from "./bundle-form";

type Supa = NonNullable<Awaited<ReturnType<typeof getAdmin>>>["supabase"];

/** Every sellable product size, for picking box contents. */
export async function loadVariantOptions(supabase: Supa): Promise<VariantOption[]> {
  const [{ data: variants }, { data: prices }] = await Promise.all([
    supabase
      .from("variants")
      .select("id, is_active, label_en, sort, option_values(label_en, sort), products!inner(name_en, status, sort, color, coatings(color))")
      .neq("products.status", "archived"),
    supabase.from("variant_prices").select("variant_id, price, cost"),
  ]);
  const priceOf = new Map((prices ?? []).map((p) => [p.variant_id, p]));
  return (variants ?? [])
    .filter((v) => v.is_active)
    .sort((a, b) => (a.products?.sort ?? 0) - (b.products?.sort ?? 0) || (a.option_values?.sort ?? a.sort) - (b.option_values?.sort ?? b.sort))
    .map((v) => ({
      id: v.id,
      label: `${v.products?.name_en} · ${v.option_values?.label_en ?? v.label_en ?? "Standard"}`,
      price: priceOf.get(v.id)?.price ?? null,
      cost: priceOf.get(v.id)?.cost ?? null,
      color: v.products?.color ?? v.products?.coatings?.color ?? null,
    }));
}
