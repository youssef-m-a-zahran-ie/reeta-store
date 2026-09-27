import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteBase, saveBase } from "../actions";

export const metadata: Metadata = { title: "Bases" };

type Cat = { id: string; name_en: string };

export default async function BasesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: bases }, { data: categories }, { data: products }] = await Promise.all([
    supabase.from("bases").select("*").order("sort").order("name_en"),
    supabase.from("categories").select("id, name_en").order("sort"),
    supabase.from("products").select("base_id"),
  ]);
  const counts = new Map<string, number>();
  products?.forEach((p) => p.base_id && counts.set(p.base_id, (counts.get(p.base_id) ?? 0) + 1));

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Bases"
        description="What gets coated: cashew, almond, peanut, strawberry. Used for filters on the store and for price templates."
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/bases" />

      <div className="grid gap-4">
        <Section title="Bases" description="Switch a base off to hide it from filters without touching its products.">
          <div className="grid gap-3">
            {bases?.map((b) => (
              <div key={b.id} className="grid gap-2 rounded-2xl border border-line p-4">
                <ActionForm action={saveBase} className="grid gap-3">
                  <input type="hidden" name="id" value={b.id} />
                  <BaseFields b={b} categories={categories ?? []} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <Toggle name="is_active" defaultChecked={b.is_active} label="On" />
                      <span className="text-sm text-muted">{counts.get(b.id) ?? 0} products</span>
                    </div>
                    <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="flex justify-end">
                  <DeleteForm action={deleteBase} id={b.id} question={`Delete ${b.name_en}? Only works when no product uses it.`} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Add a base">
          <ActionForm action={saveBase} resetOnSuccess className="grid gap-3">
            <BaseFields categories={categories ?? []} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle name="is_active" defaultChecked label="On" />
              <SubmitButton pending="Adding…">Add base</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

function BaseFields({
  b,
  categories,
}: {
  b?: { name_en: string; name_ar: string; slug: string; sort: number; category_id: string | null };
  categories: Cat[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="field">
        <span className="label">English</span>
        <input className="input" name="name_en" defaultValue={b?.name_en} required placeholder="Hazelnut" />
      </label>
      <label className="field">
        <span className="label">Arabic</span>
        <input className="input" name="name_ar" defaultValue={b?.name_ar} required dir="rtl" placeholder="بندق" />
      </label>
      <label className="field">
        <span className="label">Category</span>
        <select className="input" name="category_id" defaultValue={b?.category_id ?? ""}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_en}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">URL name</span>
        <input className="input" name="slug" defaultValue={b?.slug} placeholder="auto" />
      </label>
      <label className="field">
        <span className="label">Order</span>
        <input className="input num" name="sort" type="number" defaultValue={b?.sort ?? 0} />
      </label>
    </div>
  );
}
