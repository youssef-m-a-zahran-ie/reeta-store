import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, PageHeader, Section, Swatch, Tabs } from "@/components/admin/ui";
import { ActionForm, ColorPicker, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteCoating, saveCoating } from "../actions";

export const metadata: Metadata = { title: "Coatings" };

export default async function CoatingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: coatings }, { data: products }] = await Promise.all([
    supabase.from("coatings").select("*").order("sort").order("name_en"),
    supabase.from("products").select("coating_id"),
  ]);
  const counts = new Map<string, number>();
  products?.forEach((p) => p.coating_id && counts.set(p.coating_id, (counts.get(p.coating_id) ?? 0) + 1));

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Coatings"
        description="What products are coated with. Each coating has a color from the brand palette, and products take that color on their pouch band."
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/coatings" />

      <div className="grid gap-4">
        {coatings?.map((c) => (
          <Section key={c.id}>
            <ActionForm action={saveCoating} className="grid gap-4">
              <input type="hidden" name="id" value={c.id} />
              <div className="flex flex-wrap items-center gap-3">
                <Swatch color={c.color} size={26} />
                <h2 className="text-lg font-semibold">{c.name_en}</h2>
                <span className="text-sm text-muted">{counts.get(c.id) ?? 0} products</span>
              </div>
              <CoatingFields c={c} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Toggle name="is_active" defaultChecked={c.is_active} label="On" />
                <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-2 flex justify-end">
              <DeleteForm action={deleteCoating} id={c.id} question={`Delete ${c.name_en}? Only works when no product uses it.`} />
            </div>
          </Section>
        ))}

        <Section title="Add a coating">
          <ActionForm action={saveCoating} resetOnSuccess className="grid gap-4">
            <CoatingFields />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle name="is_active" defaultChecked label="On" />
              <SubmitButton pending="Adding…">Add coating</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

function CoatingFields({ c }: { c?: { name_en: string; name_ar: string; slug: string; sort: number; color: string } }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field">
          <span className="label">English</span>
          <input className="input" name="name_en" defaultValue={c?.name_en} required placeholder="Pistachio" />
        </label>
        <label className="field">
          <span className="label">Arabic</span>
          <input className="input" name="name_ar" defaultValue={c?.name_ar} required dir="rtl" placeholder="بستاشيو" />
        </label>
        <label className="field">
          <span className="label">URL name</span>
          <input className="input" name="slug" defaultValue={c?.slug} placeholder="auto" />
        </label>
        <label className="field">
          <span className="label">Order</span>
          <input className="input num" name="sort" type="number" defaultValue={c?.sort ?? 0} />
        </label>
      </div>
      <div className="field">
        <span className="label">Band color</span>
        <ColorPicker name="color" defaultValue={c?.color} />
      </div>
    </div>
  );
}
