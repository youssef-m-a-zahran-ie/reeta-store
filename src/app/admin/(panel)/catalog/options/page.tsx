import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteOptionType, deleteOptionValue, saveOptionType, saveOptionValue } from "../actions";

export const metadata: Metadata = { title: "Options" };

export default async function OptionsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: types }, { data: values }, { data: products }] = await Promise.all([
    supabase.from("option_types").select("*").order("created_at"),
    supabase.from("option_values").select("*").order("sort"),
    supabase.from("products").select("option_type_id"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Options"
        description="How products are sold: by weight (50, 100, 250, 350 g), by size, by piece. Adding a new option here adds it to every product sold that way."
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/options" />

      <div className="grid gap-4">
        {types?.map((t) => {
          const used = products?.filter((p) => p.option_type_id === t.id).length ?? 0;
          const vals = values?.filter((v) => v.option_type_id === t.id) ?? [];
          return (
            <Section key={t.id} title={t.name_en} description={`${t.name_ar} · ${used} products · unit: ${t.unit ?? "none"}`}>
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <p className="label">Choices</p>
                  {vals.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line p-3">
                      <ActionForm action={saveOptionValue} className="flex flex-1 flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="option_type_id" value={t.id} />
                        <ValueFields v={v} unit={t.unit} />
                        <SubmitButton className="btn btn-secondary btn-sm">Save</SubmitButton>
                      </ActionForm>
                      <DeleteForm
                        action={deleteOptionValue}
                        id={v.id}
                        question={`Delete ${v.label_en} from every product? Only works if it was never ordered.`}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 rounded-2xl bg-page p-4">
                  <p className="label">Add a choice</p>
                  <ActionForm action={saveOptionValue} resetOnSuccess className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="option_type_id" value={t.id} />
                    <ValueFields unit={t.unit} />
                    <SubmitButton className="btn btn-primary btn-sm" pending="Adding…">
                      Add
                    </SubmitButton>
                  </ActionForm>
                </div>

                <details className="rounded-2xl border border-line p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-plum">Rename or delete “{t.name_en}”</summary>
                  <ActionForm action={saveOptionType} className="mt-4 grid gap-3">
                    <input type="hidden" name="id" value={t.id} />
                    <TypeFields t={t} />
                    <div>
                      <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-3 flex justify-end">
                    <DeleteForm action={deleteOptionType} id={t.id} question={`Delete “${t.name_en}”? Only works when no product is sold by it.`} />
                  </div>
                </details>
              </div>
            </Section>
          );
        })}

        <Section title="Add a new way to sell" description="For example “Cake size” with Small, Medium, Large, or “Bottle” with 250 ml and 1 L.">
          <ActionForm action={saveOptionType} resetOnSuccess className="grid gap-3">
            <TypeFields />
            <div>
              <SubmitButton pending="Adding…">Add</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

function TypeFields({ t }: { t?: { name_en: string; name_ar: string; slug: string; unit: string | null } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="field">
        <span className="label">English</span>
        <input className="input" name="name_en" defaultValue={t?.name_en} required placeholder="Cake size" />
      </label>
      <label className="field">
        <span className="label">Arabic</span>
        <input className="input" name="name_ar" defaultValue={t?.name_ar} required dir="rtl" placeholder="حجم الكيكة" />
      </label>
      <label className="field">
        <span className="label">URL name</span>
        <input className="input" name="slug" defaultValue={t?.slug} placeholder="auto" />
      </label>
      <label className="field">
        <span className="label">Unit</span>
        <select className="input" name="unit" defaultValue={t?.unit ?? ""}>
          <option value="">None</option>
          <option value="g">Grams (g)</option>
          <option value="ml">Millilitres (ml)</option>
          <option value="pcs">Pieces</option>
        </select>
      </label>
    </div>
  );
}

function ValueFields({
  v,
  unit,
}: {
  v?: { label_en: string; label_ar: string; amount: number | null; sort: number };
  unit: string | null;
}) {
  return (
    <>
      <label className="field w-32 grow">
        <span className="hint">English</span>
        <input className="input" name="label_en" defaultValue={v?.label_en} required placeholder="500 g" />
      </label>
      <label className="field w-32 grow">
        <span className="hint">Arabic</span>
        <input className="input" name="label_ar" defaultValue={v?.label_ar} required dir="rtl" placeholder="500 جرام" />
      </label>
      <label className="field w-28">
        <span className="hint">Amount{unit ? ` (${unit})` : ""}</span>
        <input className="input num" name="amount" type="number" step="0.01" min="0" defaultValue={v?.amount ?? ""} />
      </label>
      <label className="field w-20">
        <span className="hint">Order</span>
        <input className="input num" name="sort" type="number" defaultValue={v?.sort ?? 0} />
      </label>
    </>
  );
}
