"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { egp, slugify } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";
import { saveBundle } from "./actions";

export type VariantOption = { id: string; label: string; price: number | null; cost: number | null; color: string | null; active?: boolean };

export function BundleForm({
  bundle,
  items,
  options,
}: {
  bundle: Tables<"bundles"> | null;
  items: { variant_id: string; qty: number }[];
  options: VariantOption[];
}) {
  const [rows, setRows] = useState(items.length ? items : [{ variant_id: "", qty: 1 }]);
  const [nameEn, setNameEn] = useState(bundle?.name_en ?? "");
  const [slug, setSlug] = useState(bundle?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(bundle));
  const [price, setPrice] = useState(bundle?.price?.toString() ?? "");

  const byId = new Map(options.map((o) => [o.id, o]));
  const chosen = rows.filter((r) => r.variant_id);
  const separate = chosen.reduce((s, r) => s + (byId.get(r.variant_id)?.price ?? 0) * r.qty, 0);
  const cost = chosen.reduce((s, r) => s + (byId.get(r.variant_id)?.cost ?? 0) * r.qty, 0);
  const p = Number(price) || 0;

  return (
    <ActionForm action={saveBundle} className="grid gap-5">
      {(state) => (
        <>
          {bundle && <input type="hidden" name="id" value={bundle.id} />}
          <input type="hidden" name="items" value={JSON.stringify(chosen)} />

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Basics</legend>
            <h2 className="text-[22px] font-semibold">Box</h2>
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
                  placeholder="The Duo Box"
                />
                <FieldError state={state} name="name_en" />
              </label>
              <label className="field">
                <span className="label">Name (Arabic)</span>
                <input className="input" name="name_ar" defaultValue={bundle?.name_ar} dir="rtl" placeholder="بوكس الدويتو" />
                <FieldError state={state} name="name_ar" />
              </label>
              <label className="field">
                <span className="label">Short text (English)</span>
                <input className="input" name="description_en" defaultValue={bundle?.description_en ?? ""} />
              </label>
              <label className="field">
                <span className="label">Short text (Arabic)</span>
                <input className="input" name="description_ar" defaultValue={bundle?.description_ar ?? ""} dir="rtl" />
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
                />
                <FieldError state={state} name="slug" />
              </label>
              <label className="field">
                <span className="label">Order</span>
                <input className="input num" name="sort" type="number" defaultValue={bundle?.sort ?? 0} />
              </label>
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Contents</legend>
            <div className="grid gap-1">
              <h2 className="text-[22px] font-semibold">What&apos;s inside</h2>
              <p className="text-sm text-muted">Stock is taken from each product when a box is ordered.</p>
            </div>
            <div className="grid gap-2">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    className="input min-w-60 flex-1"
                    value={r.variant_id}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, variant_id: e.target.value } : x)))}
                    aria-label={`Product ${i + 1}`}
                  >
                    <option value="">Pick a product and size</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                        {o.price !== null ? ` · ${egp(o.price)}` : " · no price"}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input num w-20"
                    type="number"
                    min={1}
                    max={20}
                    value={r.qty}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 1 } : x)))}
                    aria-label="Quantity"
                  />
                  <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => setRows([...rows, { variant_id: "", qty: 1 }])}>
                Add a product
              </button>
              <FieldError state={state} name="items" />
            </div>
          </fieldset>

          <fieldset className="card grid gap-4 p-5 md:p-6">
            <legend className="sr-only">Price</legend>
            <h2 className="text-[22px] font-semibold">Price</h2>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
              <label className="field">
                <span className="label">Box price (EGP)</span>
                <input className="input num" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                <FieldError state={state} name="price" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Bought separately", egp(separate)],
                  ["Customer saves", separate > p && p > 0 ? egp(separate - p) : "—"],
                  ["Your margin", p > 0 && cost > 0 ? `${Math.round(((p - cost) / p) * 100)}%` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-page px-3 py-2.5">
                    <p className="text-xs text-muted">{k}</p>
                    <p className="num text-lg font-medium text-plum">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
              {(
                [
                  ["draft", "Draft", "Hidden from the store"],
                  ["active", "Active", "Live on the store"],
                  ["archived", "Archived", "Kept for reports"],
                ] as const
              ).map(([v, l, h]) => (
                <label key={v} className="grid cursor-pointer gap-0.5 rounded-2xl border border-line px-4 py-2.5 has-[:checked]:border-plum has-[:checked]:bg-blush">
                  <input type="radio" name="status" value={v} defaultChecked={(bundle?.status ?? "draft") === v} className="sr-only" />
                  <span className="text-sm font-semibold text-plum">{l}</span>
                  <span className="text-xs text-muted">{h}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-full border border-line bg-white/95 p-2 ps-5 shadow-lg backdrop-blur">
            <span className="text-sm text-muted">{bundle ? "Save to update the store." : "Photos come after you create it."}</span>
            <SubmitButton className="btn btn-primary ms-auto" pending="Saving…">
              {bundle ? "Save box" : "Create box"}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
