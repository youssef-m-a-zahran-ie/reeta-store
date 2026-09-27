import "server-only";
import type { getAdmin } from "@/lib/admin/guard";

type Supa = NonNullable<Awaited<ReturnType<typeof getAdmin>>>["supabase"];

export async function loadLookups(supabase: Supa) {
  const [categories, bases, coatings, optionTypes, templates] = await Promise.all([
    supabase.from("categories").select("id, name_en").order("sort"),
    supabase.from("bases").select("id, name_en, category_id").order("sort"),
    supabase.from("coatings").select("id, name_en, color").order("sort"),
    supabase.from("option_types").select("id, name_en, unit").order("created_at"),
    supabase.from("price_templates").select("id, name, option_type_id, base_id").order("name"),
  ]);
  return {
    categories: categories.data ?? [],
    bases: bases.data ?? [],
    coatings: coatings.data ?? [],
    optionTypes: optionTypes.data ?? [],
    templates: templates.data ?? [],
  };
}
