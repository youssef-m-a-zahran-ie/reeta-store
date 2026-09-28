"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { saveTracking } from "./actions";

const FIELDS = [
  { name: "meta_pixel_id", label: "Meta Pixel ID", hint: "Events Manager → Data sources → your pixel.", placeholder: "1234567890123456" },
  { name: "tiktok_pixel_id", label: "TikTok Pixel ID", hint: "TikTok Ads Manager → Assets → Events → Web events.", placeholder: "CABC123DEF456GHI" },
  { name: "ga4_id", label: "Google Analytics ID", hint: "Admin → Data streams → Web → Measurement ID.", placeholder: "G-AB12CD34EF" },
] as const;

export function TrackingForm({ values }: { values: Record<(typeof FIELDS)[number]["name"], string | null> }) {
  return (
    <ActionForm action={saveTracking} className="grid gap-4">
      {(state) => (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.name} className="field content-start">
                <span className="label flex items-center gap-2">
                  {f.label}
                  {values[f.name] ? (
                    <span className="chip bg-sage/15 text-[#56633a]">On</span>
                  ) : (
                    <span className="chip bg-cocoa/10 text-cocoa/70">Off</span>
                  )}
                </span>
                <input className="input num" name={f.name} defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} dir="ltr" autoComplete="off" />
                <span className="hint">{f.hint}</span>
                <FieldError state={state} name={f.name} />
              </label>
            ))}
          </div>
          <p className="hint">
            Once an ID is saved, the store sends page views, product views, add to cart, checkout started and purchases (with the order total in EGP). Leave a
            field empty to turn that platform off.
          </p>
          <div>
            <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
