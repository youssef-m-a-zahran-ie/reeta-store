"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { changeStock } from "./actions";

const MODES = [
  { value: "add", label: "Add batch" },
  { value: "remove", label: "Remove" },
  { value: "set", label: "Set count" },
] as const;

export function StockForm({
  productId,
  unit,
  variants,
}: {
  productId: string;
  unit: "grams" | "pieces";
  variants: { id: string; label: string }[];
}) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("add");
  return (
    <ActionForm action={changeStock} resetOnSuccess className="grid gap-3">
      {(state) => (
        <>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="mode" value={mode} />
          <div className="flex flex-wrap gap-1 rounded-full bg-cocoa/5 p-1" role="radiogroup" aria-label="What happened">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-plum aria-checked:bg-plum aria-checked:text-blush"
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {unit === "pieces" && (
              <label className="field w-32">
                <span className="hint">Size</span>
                <select className="input py-2" name="variant_id" required>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field w-32">
              <span className="hint">{mode === "set" ? "Counted" : "Amount"} ({unit === "grams" ? "g" : "pcs"})</span>
              <input className="input num py-2" name="amount" type="number" min="0" step={unit === "grams" ? "1" : "1"} required />
            </label>
            <label className="field min-w-32 flex-1">
              <span className="hint">Note</span>
              <input
                className="input py-2"
                name="note"
                placeholder={mode === "add" ? "Batch of Oct 2" : mode === "remove" ? "Samples for event" : "Weekly count"}
              />
            </label>
            <SubmitButton className="btn btn-primary btn-sm" pending="Saving…">
              Save
            </SubmitButton>
          </div>
          <FieldError state={state} name="amount" />
        </>
      )}
    </ActionForm>
  );
}
