"use client";

import { useMemo, useState } from "react";
import { ActionForm, ColorPicker, FieldError, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { slugify } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";
import { saveProduct } from "./actions";

type Lookups = {
  categories: Pick<Tables<"categories">, "id" | "name_en">[];
  bases: Pick<Tables<"bases">, "id" | "name_en" | "category_id">[];
  coatings: Pick<Tables<"coatings">, "id" | "name_en" | "color">[];
  optionTypes: Pick<Tables<"option_types">, "id" | "name_en" | "unit">[];
  templates: Pick<Tables<"price_templates">, "id" | "name" | "option_type_id" | "base_id">[];
};

const STATUSES = [
  { value: "draft", label: "Draft", hint: "Hidden from the store" },
  { value: "active", label: "Active", hint: "Live on the store" },
  { value: "archived", label: "Archived", hint: "Kept for reports" },
] as const;

export function ProductForm({ product, lookups }: { product: Tables<"products"> | null; lookups: Lookups }) {
  const isNew = !product;
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [optionType, setOptionType] = useState(product?.option_type_id ?? lookups.optionTypes[0]?.id ?? "");
  const [template, setTemplate] = useState(product?.price_template_id ?? "");
  const [stockUnit, setStockUnit] = useState<"grams" | "pieces">(product?.stock_unit ?? "grams");

  const templates = useMemo(
    () => lookups.templates.filter((t) => t.option_type_id === optionType),
    [lookups.templates, optionType],
  );
  const unit = lookups.optionTypes.find((t) => t.id === optionType)?.unit;

  function onBaseChange(baseId: string) {
    const match = lookups.templates.find((t) => t.base_id === baseId && t.option_type_id === optionType);
    if (match) setTemplate(match.id);
  }

  return (
    <ActionForm action={saveProduct} className="grid gap-5">
      {(state) => (
        <>
          {product && <input type="hidden" name="id" value={product.id} />}

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Basics</legend>
            <h2 className="text-xl font-semibold">Basics</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                <span className="label">Name (English)</span>
                <input
                  className="input"
                  name="name_en"
                  value={nameEn}
                  onChange={(e) => {
                    setNameEn(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  required
                  placeholder="White Cashew"
                />
                <FieldError state={state} name="name_en" />
              </label>
              <label className="field">
                <span className="label">Name (Arabic)</span>
                <input className="input" name="name_ar" defaultValue={product?.name_ar} required dir="rtl" placeholder="كاجو بالوايت" />
                <FieldError state={state} name="name_ar" />
              </label>
              <label className="field">
                <span className="label">Category</span>
                <select className="input" name="category_id" defaultValue={product?.category_id ?? lookups.categories[0]?.id} required>
                  {lookups.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_en}
                    </option>
                  ))}
                </select>
                <FieldError state={state} name="category_id" />
              </label>
              <label className="field">
                <span className="label">URL name</span>
                <input
                  className="input"
                  name="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="white-cashew"
                />
                <span className="hint">The product link: /products/{slug || "…"}</span>
                <FieldError state={state} name="slug" />
              </label>
              <label className="field">
                <span className="label">One-line description (English)</span>
                <input className="input" name="short_en" defaultValue={product?.short_en ?? ""} placeholder="Whole cashews coated in white chocolate." />
              </label>
              <label className="field">
                <span className="label">One-line description (Arabic)</span>
                <input className="input" name="short_ar" defaultValue={product?.short_ar ?? ""} dir="rtl" />
              </label>
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Flavor</legend>
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold">Flavor and color</h2>
              <p className="text-sm text-muted">Optional. Set these for coated products so filters and the pouch band work.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                <span className="label">Base (what gets coated)</span>
                <select className="input" name="base_id" defaultValue={product?.base_id ?? ""} onChange={(e) => onBaseChange(e.target.value)}>
                  <option value="">None</option>
                  {lookups.bases.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Coating</span>
                <select className="input" name="coating_id" defaultValue={product?.coating_id ?? ""}>
                  <option value="">None</option>
                  {lookups.coatings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_en}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field">
              <span className="label">Pouch band color</span>
              <ColorPicker name="color" defaultValue={product?.color} allowNone noneLabel="Same as coating" />
              <FieldError state={state} name="color" />
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Selling</legend>
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold">How it&apos;s sold</h2>
              <p className="text-sm text-muted">
                Pick the option and a price template. Each size then gets its price from the template, and you can override
                one size below after saving.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                <span className="label">Sold by</span>
                <select
                  className="input"
                  name="option_type_id"
                  value={optionType}
                  onChange={(e) => {
                    setOptionType(e.target.value);
                    setTemplate("");
                  }}
                >
                  <option value="">One size only</option>
                  {lookups.optionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Price template</span>
                <select
                  className="input"
                  name="price_template_id"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  disabled={!optionType}
                >
                  <option value="">None, I&apos;ll price each size</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <FieldError state={state} name="price_template_id" />
              </label>
              <div className="field">
                <span className="label">Count stock in</span>
                <div className="flex flex-wrap gap-2">
                  {(["grams", "pieces"] as const).map((u) => (
                    <label
                      key={u}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium has-[:checked]:border-plum has-[:checked]:bg-blush"
                    >
                      <input type="radio" name="stock_unit" value={u} checked={stockUnit === u} onChange={() => setStockUnit(u)} className="sr-only" />
                      {u === "grams" ? "Grams (one total per product)" : "Pieces (per size)"}
                    </label>
                  ))}
                </div>
                {stockUnit === "grams" && unit && unit !== "g" && (
                  <span className="hint text-[#a33a52]">This option isn&apos;t in grams, so grams stock can&apos;t be deducted per order.</span>
                )}
              </div>
              <label className="field">
                <span className="label">Warn me when stock drops to</span>
                <div className="flex items-center gap-2">
                  <input
                    className="input num"
                    name="low_stock_threshold"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={product?.low_stock_threshold ?? (stockUnit === "grams" ? 1000 : 5)}
                  />
                  <span className="text-sm text-muted">{stockUnit === "grams" ? "g" : "pcs"}</span>
                </div>
                <FieldError state={state} name="low_stock_threshold" />
              </label>
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Details</legend>
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold">Product page details</h2>
              <p className="text-sm text-muted">Shown on the product page. Ingredients and allergens matter for trust, so fill them before going live.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["description", "Description"],
                  ["ingredients", "Ingredients"],
                  ["allergens", "Allergens"],
                  ["storage", "Storage and shelf life"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="contents">
                  <label className="field">
                    <span className="label">{label} (English)</span>
                    <textarea className="input" name={`${key}_en`} defaultValue={product?.[`${key}_en`] ?? ""} rows={key === "description" ? 4 : 2} />
                  </label>
                  <label className="field">
                    <span className="label">{label} (Arabic)</span>
                    <textarea className="input" name={`${key}_ar`} defaultValue={product?.[`${key}_ar`] ?? ""} rows={key === "description" ? 4 : 2} dir="rtl" />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Visibility</legend>
            <h2 className="text-xl font-semibold">Visibility</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
              {STATUSES.map((s) => (
                <label
                  key={s.value}
                  className="grid cursor-pointer gap-0.5 rounded-2xl border border-line px-4 py-2.5 has-[:checked]:border-plum has-[:checked]:bg-blush"
                >
                  <input type="radio" name="status" value={s.value} defaultChecked={(product?.status ?? "draft") === s.value} className="sr-only" />
                  <span className="text-sm font-semibold text-plum">{s.label}</span>
                  <span className="text-xs text-muted">{s.hint}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <Toggle name="is_featured" defaultChecked={product?.is_featured} label="Show in Bestsellers on the home page" />
              <label className="field w-28">
                <span className="hint">Order</span>
                <input className="input num" name="sort" type="number" defaultValue={product?.sort ?? 0} />
              </label>
            </div>
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-semibold text-plum">Search engine title and description</summary>
              <div className="mt-3 grid gap-3">
                <label className="field">
                  <span className="label">Title</span>
                  <input className="input" name="seo_title" defaultValue={product?.seo_title ?? ""} placeholder={`${nameEn || "Product"} · Reeta`} />
                </label>
                <label className="field">
                  <span className="label">Description</span>
                  <textarea className="input" name="seo_description" defaultValue={product?.seo_description ?? ""} rows={2} maxLength={170} />
                  <span className="hint">About 150 characters shows fully on Google.</span>
                </label>
              </div>
            </details>
          </fieldset>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-full border border-line bg-white/95 p-2 ps-5 shadow-lg backdrop-blur">
            <span className="text-sm text-muted">{isNew ? "Sizes and photos come next." : "Changes aren't saved until you save."}</span>
            <SubmitButton className="btn btn-primary ms-auto" pending={isNew ? "Creating…" : "Saving…"}>
              {isNew ? "Create product" : "Save product"}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
