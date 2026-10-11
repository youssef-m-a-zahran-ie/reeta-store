import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section, Swatch, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { BASE_VISUALS, COATING_VISUALS } from "@/store/menu/visuals";
import {
  addMenuBase,
  addMenuCoating,
  deleteMenuSize,
  removeMenuBase,
  removeMenuCoating,
  saveMenuBase,
  saveMenuCoating,
  saveMenuSize,
} from "../actions";
import { MENU_TABS } from "../tabs";

export const metadata: Metadata = { title: "Menu options" };

const TIERS = [
  { value: 1, label: "Small plate" },
  { value: 2, label: "Medium plate" },
  { value: 3, label: "Large plate" },
];

export default async function MenuOptionsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: cbases }, { data: ccoatings }, { data: sizes }, { data: allBases }, { data: allCoatings }] = await Promise.all([
    supabase.from("custom_bases").select("*, bases(name_en, name_ar)").order("sort"),
    supabase.from("custom_coatings").select("*, coatings(name_en, name_ar, color)").order("sort"),
    supabase.from("custom_sizes").select("*").order("sort").order("tier"),
    supabase.from("bases").select("id, name_en").order("sort"),
    supabase.from("coatings").select("id, name_en").order("sort"),
  ]);
  const freeBases = (allBases ?? []).filter((b) => !cbases?.some((c) => c.base_id === b.id));
  const freeCoatings = (allCoatings ?? []).filter((c) => !ccoatings?.some((x) => x.coating_id === c.id));

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Menu"
        description="Which nuts, sauces and sizes shoppers can pick from. Names come from Catalog → Bases and Coatings."
      />
      <Tabs items={MENU_TABS} current="/admin/menu/options" />

      <div className="grid gap-4">
        {/* ---------- Nuts ---------- */}
        <Section
          title="Nuts"
          description="The drawing is the cartoon nut that falls into its plate on the home page. The coating share is how much of the pouch's weight is chocolate; it's used to take the right amount off your nut and chocolate stock."
        >
          <div className="grid gap-3">
            {cbases?.map((b) => (
              <div key={b.base_id} className="grid gap-2 rounded-2xl border border-line p-4">
                <ActionForm action={saveMenuBase} className="grid gap-3">
                      <input type="hidden" name="base_id" value={b.base_id} />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-sans text-lg font-semibold">{b.bases?.name_en}</h3>
                        <span className="text-sm text-muted" dir="rtl">
                          {b.bases?.name_ar}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="field">
                          <span className="label">Drawing</span>
                          <VisualSelect name="visual" value={b.visual} options={BASE_VISUALS} />
                        </label>
                        <label className="field">
                          <span className="label">Show size as</span>
                          <select className="input" name="display" defaultValue={b.display}>
                            <option value="weight">Weight (250 g)</option>
                            <option value="size">Name only (Medium)</option>
                          </select>
                        </label>
                        <label className="field">
                          <span className="label">Coating share (%)</span>
                          <input className="input num" name="coating_share" type="number" min="0" max="90" step="1" defaultValue={b.coating_share} />
                        </label>
                        <label className="field">
                          <span className="label">Order</span>
                          <input className="input num" name="sort" type="number" defaultValue={b.sort} />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="field">
                          <span className="label">Short line, English (optional)</span>
                          <input className="input" name="note_en" defaultValue={b.note_en ?? ""} maxLength={60} placeholder="Roasted, whole kernels" />
                        </label>
                        <label className="field">
                          <span className="label">Short line, Arabic (optional)</span>
                          <input className="input" name="note_ar" defaultValue={b.note_ar ?? ""} maxLength={60} dir="rtl" placeholder="محمّص، حبات كاملة" />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Toggle name="is_active" defaultChecked={b.is_active} label="Offered" />
                        <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
                      </div>
                </ActionForm>
                <div className="flex justify-end">
                  <DeleteForm
                    action={removeMenuBase}
                    id={b.base_id}
                    label="Remove from the menu"
                    confirmText="Yes, remove"
                    question={`Remove ${b.bases?.name_en} from the menu? Its prices and stock here are deleted. To hide it for a while, switch it off instead.`}
                  />
                </div>
              </div>
            ))}
            {!cbases?.length && <EmptyState title="No nuts yet" />}

            {freeBases.length > 0 && (
              <ActionForm action={addMenuBase} resetOnSuccess className="grid gap-3 rounded-2xl border border-dashed border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="field">
                      <span className="label">Add a nut</span>
                      <select className="input" name="base_id" defaultValue="">
                        <option value="" disabled>
                          Pick from Catalog → Bases
                        </option>
                        {freeBases.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name_en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">Drawing</span>
                      <VisualSelect name="visual" value={null} options={BASE_VISUALS} />
                    </label>
                    <SubmitButton pending="Adding…">Add</SubmitButton>
              </ActionForm>
            )}
            <p className="text-xs text-muted">Plate photos for each nut and sauce are on the Plate photos tab.</p>
          </div>
        </Section>

        {/* ---------- Coatings ---------- */}
        <Section title="Sauces" description="The button name is what shoppers see on the sauce buttons (keep it short: Dark, White). Empty = the full name.">
          <div className="grid gap-3">
            {ccoatings?.map((c) => (
              <div key={c.coating_id} className="grid gap-2 rounded-2xl border border-line p-4">
                <ActionForm action={saveMenuCoating} className="grid gap-3">
                      <input type="hidden" name="coating_id" value={c.coating_id} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Swatch color={c.coatings?.color} size={22} />
                        <h3 className="font-sans text-lg font-semibold">{c.coatings?.name_en}</h3>
                        <span className="ms-auto text-sm text-muted" dir="rtl">
                          {c.coatings?.name_ar}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <input type="hidden" name="visual" value={c.visual ?? ""} />
                        <label className="field">
                          <span className="label">Button name, English</span>
                          <input className="input" name="label_en" defaultValue={c.label_en ?? ""} maxLength={20} placeholder="Dark" />
                        </label>
                        <label className="field">
                          <span className="label">Button name, Arabic</span>
                          <input className="input" name="label_ar" defaultValue={c.label_ar ?? ""} maxLength={20} dir="rtl" placeholder="دارك" />
                        </label>
                        <label className="field">
                          <span className="label">Short line, English</span>
                          <input className="input" name="note_en" defaultValue={c.note_en ?? ""} maxLength={60} placeholder="70% cocoa" />
                        </label>
                        <label className="field">
                          <span className="label">Short line, Arabic</span>
                          <input className="input" name="note_ar" defaultValue={c.note_ar ?? ""} maxLength={60} dir="rtl" placeholder="٧٠٪ كاكاو" />
                        </label>
                        <label className="field">
                          <span className="label">Order</span>
                          <input className="input num" name="sort" type="number" defaultValue={c.sort} />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Toggle name="is_active" defaultChecked={c.is_active} label="Offered" />
                        <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
                      </div>
                </ActionForm>
                <div className="flex justify-end">
                  <DeleteForm
                    action={removeMenuCoating}
                    id={c.coating_id}
                    label="Remove from the menu"
                    confirmText="Yes, remove"
                    question={`Remove ${c.coatings?.name_en} from the menu? Its prices and stock here are deleted. To hide it for a while, switch it off instead.`}
                  />
                </div>
              </div>
            ))}
            {!ccoatings?.length && <EmptyState title="No sauces yet" />}

            {freeCoatings.length > 0 && (
              <ActionForm action={addMenuCoating} resetOnSuccess className="grid gap-3 rounded-2xl border border-dashed border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="field">
                      <span className="label">Add a sauce</span>
                      <select className="input" name="coating_id" defaultValue="">
                        <option value="" disabled>
                          Pick from Catalog → Coatings
                        </option>
                        {freeCoatings.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name_en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">Color family</span>
                      <VisualSelect name="visual" value={null} options={COATING_VISUALS} />
                    </label>
                    <SubmitButton pending="Adding…">Add</SubmitButton>
              </ActionForm>
            )}
          </div>
        </Section>

        {/* ---------- Sizes ---------- */}
        <Section
          title="Sizes"
          description="The names shoppers see. Weights and prices per nut are on the Prices tab. The plate size is how big the plate looks when this size is picked."
        >
          <div className="grid gap-3">
            {sizes?.map((z) => (
              <div key={z.id} className="grid gap-2 rounded-2xl border border-line p-4">
                <ActionForm action={saveMenuSize} className="grid gap-3">
                  <input type="hidden" name="id" value={z.id} />
                  <SizeFields z={z} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Toggle name="is_active" defaultChecked={z.is_active} label="Offered" />
                    <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="flex justify-end">
                  <DeleteForm action={deleteMenuSize} id={z.id} question={`Delete ${z.name_en}? Only works if it was never ordered.`} />
                </div>
              </div>
            ))}
            <ActionForm action={saveMenuSize} resetOnSuccess className="grid gap-3 rounded-2xl border border-dashed border-line p-4">
              <span className="label">Add a size</span>
              <SizeFields />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Toggle name="is_active" defaultChecked label="Offered" />
                <SubmitButton pending="Adding…">Add size</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Section>
      </div>
    </>
  );
}

function VisualSelect({ name, value, options }: { name: string; value: string | null; options: Record<string, string> }) {
  return (
    <select className="input" name={name} defaultValue={value ?? ""} required>
      <option value="" disabled>
        Pick one
      </option>
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function SizeFields({ z }: { z?: { name_en: string; name_ar: string; slug: string; tier: number; sort: number } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="field">
        <span className="label">English</span>
        <input className="input" name="name_en" defaultValue={z?.name_en} required placeholder="Medium" />
      </label>
      <label className="field">
        <span className="label">Arabic</span>
        <input className="input" name="name_ar" defaultValue={z?.name_ar} required dir="rtl" placeholder="وسط" />
      </label>
      <label className="field">
        <span className="label">Plate on the store</span>
        <select className="input" name="tier" defaultValue={z?.tier ?? 2}>
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">URL name</span>
        <input className="input" name="slug" defaultValue={z?.slug} placeholder="auto" />
      </label>
      <label className="field">
        <span className="label">Order</span>
        <input className="input num" name="sort" type="number" defaultValue={z?.sort ?? 0} />
      </label>
    </div>
  );
}
