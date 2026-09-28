"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton, Toggle } from "@/components/admin/form-bits";
import type { Tables } from "@/lib/supabase/database.types";
import { saveDiscount } from "./actions";

type D = Tables<"discounts">;

/** ISO → value for <input type="datetime-local"> in Cairo time. */
function local(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

export function DiscountForm({ d, products, submitLabel }: { d?: D; products: { id: string; name: string }[]; submitLabel: string }) {
  const [type, setType] = useState<D["type"]>(d?.type ?? "percent");
  const [restrict, setRestrict] = useState(Boolean(d?.product_ids?.length));
  return (
    <ActionForm action={saveDiscount} resetOnSuccess={!d} className="grid gap-4">
      {(state) => (
        <>
          {d && <input type="hidden" name="id" value={d.id} />}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type">
            {(
              [
                ["percent", "% off"],
                ["fixed", "EGP off"],
                ["free_shipping", "Free delivery"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-plum has-[:checked]:border-plum has-[:checked]:bg-blush">
                <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="field">
              <span className="label">Code</span>
              <input className="input uppercase" name="code" defaultValue={d?.code ?? ""} placeholder={type === "free_shipping" ? "Empty = automatic" : "RAMADAN15"} dir="ltr" />
              <FieldError state={state} name="code" />
            </label>
            {type !== "free_shipping" && (
              <label className="field">
                <span className="label">{type === "percent" ? "Percent off" : "Amount off (EGP)"}</span>
                <input className="input num" name="value" inputMode="decimal" defaultValue={d?.value ?? ""} />
                <FieldError state={state} name="value" />
              </label>
            )}
            <label className="field">
              <span className="label">Minimum order (EGP)</span>
              <input className="input num" name="min_subtotal" inputMode="decimal" defaultValue={d?.min_subtotal ?? 0} />
              <FieldError state={state} name="min_subtotal" />
            </label>
            <label className="field">
              <span className="label">Max uses</span>
              <input className="input num" name="usage_limit" inputMode="numeric" defaultValue={d?.usage_limit ?? ""} placeholder="No limit" />
              <FieldError state={state} name="usage_limit" />
            </label>
            <label className="field">
              <span className="label">Starts (Cairo time)</span>
              <input className="input" type="datetime-local" name="starts_at" defaultValue={local(d?.starts_at ?? null)} />
            </label>
            <label className="field">
              <span className="label">Ends (Cairo time)</span>
              <input className="input" type="datetime-local" name="ends_at" defaultValue={local(d?.ends_at ?? null)} />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Note for the team</span>
              <input className="input" name="description" defaultValue={d?.description ?? ""} placeholder="Instagram giveaway, October" />
            </label>
          </div>
          {type !== "free_shipping" && (
            <div className="grid gap-2 rounded-2xl border border-line p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-plum">
                <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} className="size-4 accent-[#5b4659]" />
                Only for some products
              </label>
              {restrict && (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((p) => (
                    <label key={p.id} className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" name="product_ids" value={p.id} defaultChecked={d?.product_ids?.includes(p.id)} className="size-4 accent-[#5b4659]" />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle name="is_active" defaultChecked={d?.is_active ?? true} label="On" />
            <SubmitButton pending="Saving…">{submitLabel}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
