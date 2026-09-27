import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, EmptyState, PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { createPriceTemplate, deletePriceTemplate, savePriceGrid } from "../actions";
import { PriceCell } from "./price-cell";

export const metadata: Metadata = { title: "Price templates" };

export default async function PricesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: templates }, { data: items }, { data: types }, { data: values }, { data: bases }, { data: products }] =
    await Promise.all([
      supabase.from("price_templates").select("*").order("name"),
      supabase.from("price_template_items").select("*"),
      supabase.from("option_types").select("*").order("created_at"),
      supabase.from("option_values").select("*").order("sort"),
      supabase.from("bases").select("id, name_en").order("sort"),
      supabase.from("products").select("price_template_id"),
    ]);

  const byType = (types ?? []).map((t) => ({
    type: t,
    values: (values ?? []).filter((v) => v.option_type_id === t.id),
    templates: (templates ?? []).filter((p) => p.option_type_id === t.id),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Price templates"
        description="Set the price and cost of each size once. Every product on a template takes these prices. You can still override one product from its own page."
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/prices" />

      <div className="grid gap-4">
        {byType
          .filter((g) => g.templates.length)
          .map((g) => (
            <Section
              key={g.type.id}
              title={`Sold by ${g.type.name_en.toLowerCase()}`}
              description="Price is what the customer pays. Cost is what one pack costs you, including the pouch. Margin updates as you type."
            >
              <ActionForm action={savePriceGrid} className="grid gap-4">
                <div className="overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-page text-start">
                        <th className="px-4 py-3 text-start font-display font-semibold text-plum">Template</th>
                        {g.values.map((v) => (
                          <th key={v.id} className="px-3 py-3 text-start font-display font-semibold text-plum">
                            {v.label_en}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.templates.map((t) => {
                        const used = products?.filter((p) => p.price_template_id === t.id).length ?? 0;
                        return (
                          <tr key={t.id} className="border-t border-line align-top">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-cocoa">{t.name}</p>
                              <p className="text-xs text-muted">{used} products</p>
                            </td>
                            {g.values.map((v) => {
                              const it = items?.find((i) => i.template_id === t.id && i.option_value_id === v.id);
                              return (
                                <td key={v.id} className="px-3 py-3">
                                  <PriceCell templateId={t.id} valueId={v.id} price={it?.price ?? null} cost={it?.cost ?? null} />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <SubmitButton pending="Saving prices…">Save prices</SubmitButton>
                </div>
              </ActionForm>
              <div className="mt-4 flex flex-wrap gap-3">
                {g.templates.map((t) => (
                  <DeleteForm
                    key={t.id}
                    action={deletePriceTemplate}
                    id={t.id}
                    label={`Delete ${t.name}`}
                    question={`Delete the ${t.name} template? Only works when no product uses it.`}
                  />
                ))}
              </div>
            </Section>
          ))}

        {!templates?.length && <EmptyState title="No price templates yet">Add one below.</EmptyState>}

        <Section title="Add a template" description="Usually one per base, like “Hazelnut”, or one per product type, like “Cakes”.">
          <ActionForm action={createPriceTemplate} resetOnSuccess className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <label className="field">
              <span className="label">Name</span>
              <input className="input" name="name" required placeholder="Hazelnut" />
            </label>
            <label className="field">
              <span className="label">Sold by</span>
              <select className="input" name="option_type_id" required defaultValue={types?.[0]?.id}>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_en}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Base (optional)</span>
              <select className="input" name="base_id" defaultValue="">
                <option value="">None</option>
                {bases?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name_en}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-3">
              <SubmitButton pending="Adding…">Add template</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
