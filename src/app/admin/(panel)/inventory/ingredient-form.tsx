"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { changeIngredientStock, saveIngredientTracking } from "../menu/actions";

const MODES = [
  { value: "add", label: "Add batch" },
  { value: "remove", label: "Remove" },
  { value: "set", label: "Set count" },
] as const;

/** Stock in grams for one menu nut or sauce, plus whether it can sell out. */
export function IngredientForm({ kind, id, track, low }: { kind: "base" | "coating"; id: string; track: boolean; low: number }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("add");
  return (
    <div className="grid gap-3">
      <ActionForm action={changeIngredientStock} resetOnSuccess className="grid gap-3">
        {(state) => (
          <>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
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
              <label className="field w-32">
                <span className="hint">{mode === "set" ? "Counted" : "Amount"} (g)</span>
                <input className="input num py-2" name="amount" type="number" min="0" step="1" required />
              </label>
              <label className="field min-w-32 flex-1">
                <span className="hint">Note</span>
                <input className="input py-2" name="note" placeholder={mode === "add" ? "5 kg sack" : mode === "remove" ? "Burnt batch" : "Weekly count"} />
              </label>
              <SubmitButton className="btn btn-primary btn-sm" pending="Saving…">
                Save
              </SubmitButton>
            </div>
            <FieldError state={state} name="amount" />
          </>
        )}
      </ActionForm>
      <ActionForm action={saveIngredientTracking} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <Toggle name="track_stock" defaultChecked={track} label="Sell out when it runs out" />
        <label className="field w-28">
          <span className="hint">Warn at (g)</span>
          <input className="input num py-1.5" name="low_stock_threshold" type="number" min="0" step="1" defaultValue={low} />
        </label>
        <SubmitButton className="btn btn-secondary btn-sm">Save</SubmitButton>
      </ActionForm>
    </div>
  );
}
