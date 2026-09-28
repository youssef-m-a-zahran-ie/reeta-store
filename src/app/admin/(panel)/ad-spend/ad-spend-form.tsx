"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { PLATFORM_LABELS } from "./labels";
import { saveAdSpend } from "./actions";

export function AdSpendForm({ today }: { today: string }) {
  return (
    <ActionForm action={saveAdSpend} className="grid gap-3" resetOnSuccess>
      {(state) => (
        <>
          <label className="field">
            <span className="label">Platform</span>
            <select className="input" name="platform" defaultValue="meta">
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <FieldError state={state} name="platform" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span className="label">From</span>
              <input className="input" type="date" name="period_start" defaultValue={today} max={today} />
              <FieldError state={state} name="period_start" />
            </label>
            <label className="field">
              <span className="label">To</span>
              <input className="input" type="date" name="period_end" defaultValue={today} max={today} />
              <FieldError state={state} name="period_end" />
            </label>
          </div>
          <label className="field">
            <span className="label">Amount (EGP)</span>
            <input className="input num" name="amount" inputMode="decimal" placeholder="1500" />
            <FieldError state={state} name="amount" />
          </label>
          <label className="field">
            <span className="label">Campaign (optional)</span>
            <input className="input" name="campaign" placeholder="Launch week" />
          </label>
          <label className="field">
            <span className="label">Note (optional)</span>
            <input className="input" name="note" />
          </label>
          <p className="hint">
            For a week or a month, enter the total once with its dates. Reports split it across the days. Ad links should use
            utm_source=meta, tiktok or google so sales are matched.
          </p>
          <div>
            <SubmitButton className="btn btn-primary btn-sm">Add</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>  );
}
