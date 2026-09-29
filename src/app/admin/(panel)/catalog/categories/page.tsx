import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, PageHeader, Section, StatusChip, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteCategory, saveCategory } from "../actions";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort").order("name_en"),
    supabase.from("products").select("category_id"),
  ]);
  const counts = new Map<string, number>();
  products?.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1));

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="The big groups on the store: nuts, freeze-dried fruit, juices, cakes. The store shows a category section once there's more than one visible category."
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/categories" />

      <div className="grid gap-4">
        {categories?.map((c) => (
          <Section key={c.id}>
            <ActionForm action={saveCategory} className="grid gap-4">
              <input type="hidden" name="id" value={c.id} />
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-sans text-lg font-medium">{c.name_en}</h2>
                <StatusChip status={c.is_visible ? "active" : "draft"} label={c.is_visible ? "Visible" : "Hidden"} />
                <span className="text-sm text-muted">{counts.get(c.id) ?? 0} products</span>
              </div>
              <CategoryFields c={c} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Toggle name="is_visible" defaultChecked={c.is_visible} label="Visible on the store" />
                <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-2 flex justify-end">
              <DeleteForm action={deleteCategory} id={c.id} question={`Delete ${c.name_en}? Only works when it has no products.`} />
            </div>
          </Section>
        ))}

        <Section title="Add a category">
          <ActionForm action={saveCategory} resetOnSuccess className="grid gap-4">
            <CategoryFields />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle name="is_visible" defaultChecked label="Visible on the store" />
              <SubmitButton pending="Adding…">Add category</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

function CategoryFields({
  c,
}: {
  c?: { name_en: string; name_ar: string; slug: string; sort: number; description_en: string | null; description_ar: string | null };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="field">
        <span className="label">Name (English)</span>
        <input className="input" name="name_en" defaultValue={c?.name_en} required placeholder="Freeze-dried fruit" />
      </label>
      <label className="field">
        <span className="label">Name (Arabic)</span>
        <input className="input" name="name_ar" defaultValue={c?.name_ar} required dir="rtl" placeholder="فواكه مجففة" />
      </label>
      <label className="field">
        <span className="label">Short line (English)</span>
        <input className="input" name="description_en" defaultValue={c?.description_en ?? ""} />
      </label>
      <label className="field">
        <span className="label">Short line (Arabic)</span>
        <input className="input" name="description_ar" defaultValue={c?.description_ar ?? ""} dir="rtl" />
      </label>
      <label className="field">
        <span className="label">URL name</span>
        <input className="input" name="slug" defaultValue={c?.slug} placeholder="Made from the English name" />
        <span className="hint">Shows in the link: /shop/{c?.slug ?? "url-name"}</span>
      </label>
      <label className="field">
        <span className="label">Order</span>
        <input className="input num" name="sort" type="number" defaultValue={c?.sort ?? 0} />
        <span className="hint">Lower numbers show first.</span>
      </label>
    </div>
  );
}
