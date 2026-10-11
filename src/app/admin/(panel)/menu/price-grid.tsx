"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { Swatch } from "@/components/admin/ui";
import { margin } from "@/lib/format";
import { saveMenuPrices } from "./actions";

type Cell = { grams?: string; price: string; cost: string };
export type GridSize = { id: string; name_en: string; is_active: boolean };
export type GridBase = { id: string; name_en: string; is_active: boolean; display: "weight" | "size"; prices: Record<string, { grams: number | null; price: number | null; cost: number | null }> };
export type GridCoating = { id: string; name_en: string; color: string; is_active: boolean; prices: Record<string, { price: number | null; cost: number | null }> };

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const n = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v));
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** The whole menu price sheet: nut weights and prices per size, sauce prices per size, and a live preview of what shoppers pay. */
export function MenuPriceGrid({ sizes, bases, coatings }: { sizes: GridSize[]; bases: GridBase[]; coatings: GridCoating[] }) {
  const [bp, setBp] = useState<Record<string, Cell>>(() => {
    const o: Record<string, Cell> = {};
    bases.forEach((b) => sizes.forEach((z) => (o[`${b.id}:${z.id}`] = { grams: s(b.prices[z.id]?.grams), price: s(b.prices[z.id]?.price), cost: s(b.prices[z.id]?.cost) })));
    return o;
  });
  const [cp, setCp] = useState<Record<string, Cell>>(() => {
    const o: Record<string, Cell> = {};
    coatings.forEach((c) => sizes.forEach((z) => (o[`${c.id}:${z.id}`] = { price: s(c.prices[z.id]?.price), cost: s(c.prices[z.id]?.cost) })));
    return o;
  });
  const [previewCoat, setPreviewCoat] = useState(coatings[0]?.id ?? "");

  const set = (which: "bp" | "cp", key: string, field: keyof Cell, value: string) =>
    (which === "bp" ? setBp : setCp)((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const preview = useMemo(
    () =>
      bases.map((b) => ({
        b,
        cells: sizes.map((z) => {
          const a = bp[`${b.id}:${z.id}`];
          const c = cp[`${previewCoat}:${z.id}`];
          const price = n(a?.price) !== null && n(c?.price) !== null ? n(a.price)! + n(c.price)! : null;
          const cost = n(a?.cost) !== null && n(c?.cost) !== null ? n(a.cost)! + n(c.cost)! : null;
          const grams = n(a?.grams);
          return { z, price, cost, grams };
        }),
      })),
    [bases, sizes, bp, cp, previewCoat],
  );

  const input = "input num px-2.5 py-1.5 text-sm";

  return (
    <ActionForm action={saveMenuPrices} className="grid gap-5">
      {/* Nuts */}
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h3 className="text-[22px] font-semibold">1 · Nuts</h3>
          <p className="text-sm text-muted">
            Net weight of the pouch, its price and your cost for the nuts (and pouch). Leave a size empty to not sell this nut in that size.
          </p>
        </div>
        {bases.map((b) => (
          <div key={b.id} className={`grid gap-3 rounded-2xl border border-line p-4 ${b.is_active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold text-plum">{b.name_en}</span>
              {!b.is_active && <span className="chip bg-cream text-cocoa">Off</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {sizes.map((z) => {
                const key = `${b.id}:${z.id}`;
                const c = bp[key];
                const m = margin(n(c.price), n(c.cost));
                return (
                  <fieldset key={z.id} className={`grid gap-2 rounded-xl bg-page p-3 ${z.is_active ? "" : "opacity-60"}`}>
                    <legend className="sr-only">
                      {b.name_en}, {z.name_en}
                    </legend>
                    <span className="text-sm font-semibold text-cocoa">{z.name_en}</span>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="grid gap-1">
                        <span className="hint">Weight (g)</span>
                        <input className={input} name={`bp:${key}:grams`} inputMode="decimal" value={c.grams} onChange={(e) => set("bp", key, "grams", e.target.value)} />
                      </label>
                      <label className="grid gap-1">
                        <span className="hint">Price</span>
                        <input className={input} name={`bp:${key}:price`} inputMode="decimal" value={c.price} onChange={(e) => set("bp", key, "price", e.target.value)} />
                      </label>
                      <label className="grid gap-1">
                        <span className="hint">Cost</span>
                        <input className={input} name={`bp:${key}:cost`} inputMode="decimal" value={c.cost} onChange={(e) => set("bp", key, "cost", e.target.value)} />
                      </label>
                    </div>
                    {m !== null && <span className="num text-xs text-muted">Margin on the nuts: {m}%</span>}
                  </fieldset>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Coatings */}
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h3 className="text-[22px] font-semibold">2 · Sauces</h3>
          <p className="text-sm text-muted">What each sauce adds on top of the nut, per size. Cost is your cost for the chocolate.</p>
        </div>
        {coatings.map((co) => (
          <div key={co.id} className={`grid gap-3 rounded-2xl border border-line p-4 ${co.is_active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Swatch color={co.color} />
              <span className="font-semibold text-plum">{co.name_en}</span>
              {!co.is_active && <span className="chip bg-cream text-cocoa">Off</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {sizes.map((z) => {
                const key = `${co.id}:${z.id}`;
                const c = cp[key];
                return (
                  <fieldset key={z.id} className={`grid gap-2 rounded-xl bg-page p-3 ${z.is_active ? "" : "opacity-60"}`}>
                    <legend className="sr-only">
                      {co.name_en}, {z.name_en}
                    </legend>
                    <span className="text-sm font-semibold text-cocoa">{z.name_en}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1">
                        <span className="hint">Adds</span>
                        <input className={input} name={`cp:${key}:price`} inputMode="decimal" value={c.price} onChange={(e) => set("cp", key, "price", e.target.value)} />
                      </label>
                      <label className="grid gap-1">
                        <span className="hint">Cost</span>
                        <input className={input} name={`cp:${key}:cost`} inputMode="decimal" value={c.cost} onChange={(e) => set("cp", key, "cost", e.target.value)} />
                      </label>
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="grid gap-3 rounded-2xl bg-blush/50 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="text-[22px] font-semibold">What shoppers pay</h3>
            <p className="text-sm text-muted">Nut + sauce, updated as you type. Not saved until you press Save.</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-white/70 p-1" role="radiogroup" aria-label="Sauce for the preview">
            {coatings.map((co) => (
              <button
                key={co.id}
                type="button"
                role="radio"
                aria-checked={previewCoat === co.id}
                onClick={() => setPreviewCoat(co.id)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-plum aria-checked:bg-plum aria-checked:text-blush"
              >
                <Swatch color={co.color} size={12} />
                {co.name_en}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-start font-medium text-plum">Nut</th>
                {sizes.map((z) => (
                  <th key={z.id} className="px-3 py-2.5 text-start font-medium text-plum">
                    {z.name_en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map(({ b, cells }) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-3 py-2.5 font-medium">{b.name_en}</td>
                  {cells.map(({ z, price, cost, grams }) => (
                    <td key={z.id} className="num px-3 py-2.5">
                      {price === null ? (
                        <span className="text-muted">Not sold</span>
                      ) : (
                        <span className="grid">
                          <b className="font-semibold text-cocoa">{fmt.format(price)} EGP</b>
                          <span className="text-xs text-muted">
                            {[grams ? `${fmt.format(grams)} g` : null, grams ? `${fmt.format((price / grams) * 100)} / 100 g` : null, margin(price, cost) !== null ? `${margin(price, cost)}% margin` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-3 z-10">
        <SubmitButton className="btn btn-primary shadow-lg" pending="Saving prices…">
          Save prices and weights
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
