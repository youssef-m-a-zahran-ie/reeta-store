"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { egp } from "@/lib/format";
import { adminQuote, createManualOrder, type AdminQuote, type ManualInput } from "../manual-actions";

export type PickOption = { key: string; label: string; price: number | null };
type Row = { key: string; qty: number };

/** Pulls "lat, lng" out of pasted coordinates or a Google Maps link. */
function parseLocation(text: string): { lat: number; lng: number } | null {
  const t = decodeURIComponent(text);
  const m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? t.match(/(-?\d{1,2}\.\d{3,})\s*,\s*\+?(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < 21.5 || lat > 32 || lng < 24.5 || lng > 37) return null;
  return { lat, lng };
}

const SOURCES = [
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["phone", "Phone call"],
  ["other", "Other"],
] as const;

export function ManualOrderForm({
  options,
  initial,
}: {
  options: { products: PickOption[]; bundles: PickOption[] };
  initial: { name: string; phone: string; address_line: string; building: string; floor: string; apartment: string; landmark: string; location: string };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([{ key: "", qty: 1 }]);
  const [f, setF] = useState({
    ...initial,
    shipping_fee: "",
    discount_code: "",
    payment_method: "cod" as ManualInput["payment_method"],
    paid: false,
    status: "confirmed" as ManualInput["status"],
    source: "whatsapp" as ManualInput["source"],
    lang: "ar" as ManualInput["lang"],
    allow_short_stock: false,
    note: "",
    internal_note: "",
  });
  const [quote, setQuote] = useState<AdminQuote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const loc = f.location.trim() ? parseLocation(f.location) : null;
  const locBad = f.location.trim() !== "" && !loc;
  const items = rows
    .filter((r) => r.key)
    .map((r) => ({ kind: r.key.startsWith("b:") ? ("bundle" as const) : ("variant" as const), id: r.key.slice(2), qty: r.qty }));
  const quoteKey = JSON.stringify([items, loc, f.shipping_fee, f.discount_code, f.allow_short_stock]);

  useEffect(() => {
    const [its, l, fee, code, allow] = JSON.parse(quoteKey);
    if (!its.length) return;
    const t = setTimeout(async () => {
      const q = await adminQuote({ items: its, lat: l?.lat ?? null, lng: l?.lng ?? null, shipping_fee: fee, discount_code: code, allow_short_stock: allow });
      setQuote(q);
    }, 350);
    return () => clearTimeout(t);
  }, [quoteKey]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const shown = items.length ? quote : null;
  const profit = shown && shown.lines.every((l) => l.unit_cost !== null)
    ? shown.subtotal - shown.discount_total - shown.lines.reduce((s, l) => s + (l.unit_cost ?? 0) * l.qty, 0)
    : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await createManualOrder({
        items,
        name: f.name,
        phone: f.phone,
        address_line: f.address_line,
        building: f.building,
        floor: f.floor,
        apartment: f.apartment,
        landmark: f.landmark,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        shipping_fee: f.shipping_fee,
        discount_code: f.discount_code,
        payment_method: f.payment_method,
        paid: f.paid,
        status: f.status,
        source: f.source,
        lang: f.lang,
        allow_short_stock: f.allow_short_stock,
        note: f.note,
        internal_note: f.internal_note,
      });
      if (res.ok) router.push(`/admin/orders/${res.id}?created=1`);
      else setMessage(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <div className="grid min-w-0 gap-5">
        <fieldset className="card grid gap-4 p-5 md:p-6">
          <legend className="sr-only">Where it came from</legend>
          <h2 className="text-[22px] font-semibold">Where it came from</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Source">
            {SOURCES.map(([v, l]) => (
              <label key={v} className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-plum has-[:checked]:border-plum has-[:checked]:bg-plum has-[:checked]:text-blush">
                <input type="radio" name="source" value={v} checked={f.source === v} onChange={() => set("source", v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:p-6">
          <legend className="sr-only">Items</legend>
          <h2 className="text-[22px] font-semibold">Items</h2>
          <div className="grid gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className="input min-w-60 flex-1"
                  value={r.key}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                  aria-label={`Item ${i + 1}`}
                >
                  <option value="">Pick a product or box</option>
                  <optgroup label="Products">
                    {options.products.map((o) => (
                      <option key={o.key} value={o.key} disabled={o.price === null}>
                        {o.label} · {o.price === null ? "no price" : egp(o.price)}
                      </option>
                    ))}
                  </optgroup>
                  {options.bundles.length > 0 && (
                    <optgroup label="Boxes">
                      {options.bundles.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label} · {egp(o.price)}
                        </option>
                      ))}
                    </optgroup>
                  )}
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
            <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => setRows([...rows, { key: "", qty: 1 }])}>
              Add an item
            </button>
            {!options.products.length && <p className="hint">Only active products show here. Activate products in the catalog first.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.allow_short_stock} onChange={(e) => set("allow_short_stock", e.target.checked)} className="size-4 accent-plum" />
            Sell anyway if the stock numbers say it&apos;s out (it&apos;s on the shelf)
          </label>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:p-6">
          <legend className="sr-only">Customer</legend>
          <h2 className="text-[22px] font-semibold">Customer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">Phone</span>
              <input className="input num" value={f.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" inputMode="tel" placeholder="01…" required />
            </label>
            <label className="field">
              <span className="label">Name</span>
              <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Address</span>
              <input className="input" value={f.address_line} onChange={(e) => set("address_line", e.target.value)} placeholder="Street, area" required />
            </label>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <label className="field">
                <span className="hint">Building</span>
                <input className="input" value={f.building} onChange={(e) => set("building", e.target.value)} />
              </label>
              <label className="field">
                <span className="hint">Floor</span>
                <input className="input" value={f.floor} onChange={(e) => set("floor", e.target.value)} />
              </label>
              <label className="field">
                <span className="hint">Apartment</span>
                <input className="input" value={f.apartment} onChange={(e) => set("apartment", e.target.value)} />
              </label>
            </div>
            <label className="field sm:col-span-2">
              <span className="hint">Landmark</span>
              <input className="input" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Location (optional)</span>
              <input
                className="input"
                value={f.location}
                onChange={(e) => set("location", e.target.value)}
                dir="ltr"
                placeholder="Paste coordinates like 30.0444, 31.2357 or a Google Maps link"
              />
              <span className={`hint ${locBad ? "font-semibold text-[#a33a52]" : ""}`}>
                {locBad
                  ? "Couldn't read a location from that. Short links (maps.app.goo.gl) don't include coordinates: open the link, then copy the numbers."
                  : loc
                    ? `Got it: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}. Delivery is priced from it.`
                    : "With a location the delivery fee is worked out for you. Without one, type the fee."}
              </span>
            </label>
            <label className="field">
              <span className="label">Delivery fee (EGP)</span>
              <input
                className="input num"
                inputMode="decimal"
                value={f.shipping_fee}
                onChange={(e) => set("shipping_fee", e.target.value)}
                placeholder={loc ? "Leave empty to use the map price" : "Required without a location"}
              />
            </label>
            <label className="field">
              <span className="label">Messages in</span>
              <select className="input" value={f.lang} onChange={(e) => set("lang", e.target.value as "en" | "ar")}>
                <option value="ar">Arabic</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:p-6">
          <legend className="sr-only">Payment and notes</legend>
          <h2 className="text-[22px] font-semibold">Payment and notes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">Pays with</span>
              <select className="input" value={f.payment_method} onChange={(e) => set("payment_method", e.target.value as "cod" | "instapay")}>
                <option value="cod">Cash on delivery</option>
                <option value="instapay">InstaPay</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Discount code (optional)</span>
              <input className="input uppercase" value={f.discount_code} onChange={(e) => set("discount_code", e.target.value.toUpperCase())} dir="ltr" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.paid} onChange={(e) => set("paid", e.target.checked)} className="size-4 accent-plum" />
              Already paid
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.status === "confirmed"} onChange={(e) => set("status", e.target.checked ? "confirmed" : "new")} className="size-4 accent-plum" />
              Already confirmed with the customer
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Customer&apos;s note</span>
              <input className="input" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Ring twice, deliver after 6pm…" />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Internal note</span>
              <input className="input" value={f.internal_note} onChange={(e) => set("internal_note", e.target.value)} placeholder="Only the team sees this" />
            </label>
          </div>
        </fieldset>
      </div>

      <aside className="card grid gap-4 p-5 lg:sticky lg:top-8">
        <h2 className="text-[22px] font-semibold">Summary</h2>
        {!shown ? (
          <p className="text-sm text-muted">Pick items to see the total.</p>
        ) : (
          <>
            <ul className="grid gap-1.5 text-[15px]">
              {shown.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {l.qty}× {l.name_en}
                    {l.label_en && <span className="text-muted"> · {l.label_en}</span>}
                  </span>
                  <span className="num">{egp(l.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1.5 border-t border-line pt-3 text-[15px]">
              <Line label="Subtotal" value={egp(shown.subtotal)} />
              {shown.discount_total > 0 && <Line label={`Discount (${shown.discount?.code})`} value={`−${egp(shown.discount_total)}`} />}
              <Line
                label={`Delivery${shown.distance_km ? ` · ${shown.distance_km} km` : ""}${shown.fee_overridden ? " · typed" : ""}`}
                value={shown.free_shipping && !shown.fee_overridden ? "Free" : egp(shown.shipping_fee)}
              />
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-lg font-medium text-plum">
                <dt>Total</dt>
                <dd className="num">{egp(shown.total)}</dd>
              </div>
              {profit !== null && <Line label="Profit on products" value={egp(profit)} muted />}
            </dl>
            {shown.errors.length > 0 && (
              <ul className="grid gap-1 rounded-xl bg-rose/12 px-3 py-2 text-sm font-medium text-[#a33a52]">
                {shown.errors.map((e, i) => (
                  <li key={i}>
                    {e.code === "out_of_stock"
                      ? `${e.name_en} is out of stock`
                      : e.code === "invalid_code"
                        ? "That code isn't active"
                        : e.code === "code_min"
                          ? `Code needs ${e.min} EGP or more`
                          : "An item can't be sold right now"}
                  </li>
                ))}
              </ul>
            )}
            {(shown.short_stock?.length ?? 0) > 0 && (
              <p className="rounded-xl bg-honey/25 px-3 py-2 text-sm">
                Selling past recorded stock: {shown.short_stock!.map((s) => s.name_en).join(", ")}. Fix the numbers in Inventory later.
              </p>
            )}
          </>
        )}
        {message && (
          <p role="alert" className="rounded-xl bg-rose/12 px-3.5 py-2 text-sm font-medium text-[#a33a52]">
            {message}
          </p>
        )}
        <button className="btn btn-primary" disabled={pending || !items.length}>
          {pending ? "Adding…" : "Add order"}
        </button>
        <p className="hint">No email is sent for orders you add yourself.</p>
      </aside>
    </form>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? "text-sm text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
