"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { egp, margin, stockLabel } from "@/lib/format";
import { saveVariants } from "./actions";

export type VariantRow = {
  id: string;
  label: string;
  custom: boolean; // no option type: the label is editable
  label_en: string | null;
  label_ar: string | null;
  is_active: boolean;
  price: number | null; // override
  cost: number | null; // override
  template_price: number | null;
  template_cost: number | null;
  stock_qty: number;
};

export function VariantsForm({
  productId,
  variants,
  stockUnit,
  templateName,
}: {
  productId: string;
  variants: VariantRow[];
  stockUnit: "grams" | "pieces";
  templateName: string | null;
}) {
  return (
    <ActionForm action={saveVariants} className="grid gap-4">
      <input type="hidden" name="product_id" value={productId} />
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-page">
              <th className="px-4 py-3 text-start font-medium text-plum">Size</th>
              <th className="px-3 py-3 text-start font-medium text-plum">Sell it</th>
              <th className="px-3 py-3 text-start font-medium text-plum">Price</th>
              <th className="px-3 py-3 text-start font-medium text-plum">Cost</th>
              <th className="px-3 py-3 text-start font-medium text-plum">Margin</th>
              {stockUnit === "pieces" && <th className="px-3 py-3 text-start font-medium text-plum">Stock</th>}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <Row key={v.id} v={v} stockUnit={stockUnit} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        {templateName
          ? `Leave a price empty to use the “${templateName}” template. Type a number to override it for this product only.`
          : "This product has no price template, so every size needs its own price."}
      </p>
      <div>
        <SubmitButton pending="Saving sizes…">Save sizes and prices</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Row({ v, stockUnit }: { v: VariantRow; stockUnit: "grams" | "pieces" }) {
  const [price, setPrice] = useState(v.price?.toString() ?? "");
  const [cost, setCost] = useState(v.cost?.toString() ?? "");
  const effPrice = price === "" ? v.template_price : Number(price);
  const effCost = cost === "" ? v.template_cost : Number(cost);
  const m = margin(effPrice, effCost);
  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3">
        <input type="hidden" name="variant_id" value={v.id} />
        {v.custom ? (
          <div className="grid w-44 gap-1.5">
            <input className="input py-1.5" name={`label_en:${v.id}`} defaultValue={v.label_en ?? ""} placeholder="Standard" aria-label="Size name in English" />
            <input className="input py-1.5" name={`label_ar:${v.id}`} defaultValue={v.label_ar ?? ""} placeholder="عادي" dir="rtl" aria-label="Size name in Arabic" />
          </div>
        ) : (
          <span className="font-semibold text-cocoa">{v.label}</span>
        )}
      </td>
      <td className="px-3 py-3">
        <label className="inline-flex cursor-pointer items-center">
          <input type="checkbox" name={`on:${v.id}`} defaultChecked={v.is_active} className="peer sr-only" />
          <span className="relative h-6 w-11 rounded-full bg-cocoa/15 transition peer-checked:bg-plum peer-focus-visible:ring-2 peer-focus-visible:ring-rose after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          <span className="sr-only">Sell {v.label}</span>
        </label>
      </td>
      <td className="px-3 py-3">
        <input
          className="input num w-28 py-1.5"
          name={`price:${v.id}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={v.template_price !== null ? String(v.template_price) : "EGP"}
          aria-label={`Price for ${v.label}`}
        />
        {price === "" && v.template_price === null && <span className="mt-1 block text-xs font-semibold text-[#a33a52]">No price</span>}
      </td>
      <td className="px-3 py-3">
        <input
          className="input num w-28 py-1.5"
          name={`cost:${v.id}`}
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder={v.template_cost !== null ? String(v.template_cost) : "EGP"}
          aria-label={`Cost for ${v.label}`}
        />
      </td>
      <td className="num px-3 py-3">
        {m === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className={`font-semibold ${m < 30 ? "text-[#a33a52]" : "text-[#56633a]"}`}>
            {m}% <span className="font-normal text-muted">· {egp((effPrice ?? 0) - (effCost ?? 0))}</span>
          </span>
        )}
      </td>
      {stockUnit === "pieces" && <td className="num px-3 py-3 text-muted">{stockLabel("pieces", v.stock_qty)}</td>}
    </tr>
  );
}
