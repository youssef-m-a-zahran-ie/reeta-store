"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "../analytics";
import { useCart } from "../cart";
import { dict, href, loc, money, number, type Lang } from "../i18n";
import { readUtm } from "../utm";
import { getQuote, placeOrder, trackCheckout, type CartRef, type Quote } from "../checkout-actions";
import { LocationPicker, type LatLng } from "./location-picker";

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
function validPhone(p: string) {
  const d = toLatin(p).replace(/\D/g, "");
  return /^(01[0125]\d{8}|201[0125]\d{8}|00201[0125]\d{8})$/.test(d);
}

type Field = "name" | "phone" | "location" | "address";

export function CheckoutForm({ lang, paused }: { lang: Lang; paused: boolean }) {
  const t = dict[lang];
  const c = t.checkout;
  const router = useRouter();
  const { items, syncPrices, setQty, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [address, setAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pay, setPay] = useState<"cod" | "instapay">("cod");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const refs: CartRef[] = useMemo(
    () => items.map((i) => ({ kind: i.kind, id: i.id, qty: i.qty })),
    [items],
  );
  const refsKey = JSON.stringify(refs);

  // Tell the pixels a checkout started, once per visit to this page.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !items.length) return;
    checkoutTracked.current = true;
    const t = setTimeout(
      () => track("begin_checkout", { items: items.map((i) => ({ id: i.id, name: i.name_en, price: i.price, qty: i.qty, variant: i.label_en })) }),
      800,
    );
    return () => clearTimeout(t);
  }, [items]);

  // Live quote: prices, stock, discount, delivery.
  useEffect(() => {
    if (!refs.length) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const q = await getQuote({ items: refs, lat: pin?.lat, lng: pin?.lng, code });
      if (!alive || !q) return;
      setQuote(q);
      const prices: Record<string, number> = {};
      q.lines.forEach((l) => (prices[`${l.kind === "bundle" ? "b" : "v"}:${l.id}`] = l.unit_price));
      syncPrices(prices);
      if (code) {
        const bad = q.errors.find((e) => e.code === "invalid_code" || e.code === "code_min");
        if (bad) {
          setCodeMsg(bad.code === "invalid_code" ? c.errors.invalid_code : c.errors.code_min(money(bad.min ?? 0, lang)));
          setCode("");
        } else if (q.discount) setCodeMsg(c.codeApplied(q.discount.code));
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // refsKey stands in for refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refsKey, pin?.lat, pin?.lng, code]);

  function clearErr(f: Field) {
    setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));
    setFormError(null);
  }

  const unavailable = new Set((quote?.errors ?? []).filter((e) => e.code === "unavailable").map((e) => e.id));
  const outOfStock = (quote?.errors ?? []).filter((e) => e.code === "out_of_stock");
  const isPaused = paused || Boolean(quote?.orders_paused);

  function validate() {
    const e: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) e.name = c.errors.name;
    if (!validPhone(phone)) e.phone = c.errors.phone;
    if (!pin) e.location = c.errors.location;
    if (address.trim().length < 3) e.address = c.errors.address;
    setErrors(e);
    return e;
  }

  async function submit() {
    setFormError(null);
    const found = validate();
    if (Object.keys(found).length) {
      setFormError(Object.values(found)[0] ?? null);
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPlacing(true);
    const res = await placeOrder({
      items: refs,
      name,
      phone,
      address_line: address,
      building,
      floor,
      apartment,
      landmark,
      lat: pin!.lat,
      lng: pin!.lng,
      payment_method: pay,
      discount_code: code,
      note,
      lang,
      website,
      utm: readUtm(),
    });
    if (res.ok) {
      clear();
      router.push(href(lang, `/order/${res.id}`));
      return;
    }
    setPlacing(false);
    const first = res.errors?.[0];
    if (res.code === "orders_paused") setFormError(c.paused);
    else if (res.code === "invalid_phone") setErrors({ phone: c.errors.phone });
    else if (res.code === "invalid_location") setErrors({ location: c.errors.location });
    else if (res.code === "invalid_name") setErrors({ name: c.errors.name });
    else if (res.code === "invalid_address") setErrors({ address: c.errors.address });
    else if (res.code === "too_many_orders") setFormError(c.errors.too_many_orders);
    else if (res.code === "store_busy") setFormError(c.errors.store_busy);
    else if (first?.code === "out_of_stock") setFormError(c.errors.out_of_stock(lang === "ar" ? (first.name_ar ?? "") : (first.name_en ?? "")));
    else if (first?.code === "unavailable") setFormError(c.errors.unavailable);
    else if (first?.code === "invalid_code") setFormError(c.errors.invalid_code);
    else if (first?.code === "code_min") setFormError(c.errors.code_min(money(first.min ?? 0, lang)));
    else setFormError(c.errors.generic);
    // Refresh the quote so the summary shows what changed.
    const q = await getQuote({ items: refs, lat: pin?.lat, lng: pin?.lng, code });
    if (q) setQuote(q);
  }

  if (!items.length) {
    return (
      <div className="grid justify-items-center gap-4 rounded-[28px] border-2 border-dashed border-plum/20 px-6 py-14 text-center">
        <p className="text-lg text-plum">{c.empty}</p>
        <Link href={href(lang, "/shop")} className="rounded-full bg-plum px-6 py-3 font-display font-semibold text-blush hover:bg-plum-hover">
          {t.nav.shop}
        </Link>
      </div>
    );
  }

  const section = "grid gap-4 rounded-[28px] bg-white/70 p-5 md:p-7 border border-plum/10";
  const h2 = "text-2xl font-semibold";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
      <div className="grid gap-5">
        <section className={section} aria-labelledby="co-you">
          <h2 id="co-you" className={h2}>
            {c.you}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{c.name}</span>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearErr("name");
                }}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                maxLength={80}
              />
              {errors.name && <span className="text-sm font-medium text-[#a33a52]">{errors.name}</span>}
            </label>
            <label className="field">
              <span className="label">{c.phone}</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearErr("phone");
                }}
                onBlur={() => {
                  if (validPhone(phone))
                    void trackCheckout({
                      phone,
                      name,
                      cart: items.map((i) => ({ name: i.name_en, label: i.label_en, qty: i.qty, price: i.price })),
                      subtotal: quote?.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0),
                      utm: readUtm(),
                    });
                }}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="010 1234 5678"
                aria-invalid={Boolean(errors.phone)}
                maxLength={20}
              />
              {errors.phone ? (
                <span className="text-sm font-medium text-[#a33a52]">{errors.phone}</span>
              ) : (
                <span className="hint">{c.phoneHint}</span>
              )}
            </label>
          </div>
        </section>

        <section className={section} aria-labelledby="co-where">
          <h2 id="co-where" className={h2}>
            {c.where}
          </h2>
          <div aria-invalid={Boolean(errors.location)}>
            <LocationPicker
              lang={lang}
              value={pin}
              onChange={(v) => {
                setPin(v);
                clearErr("location");
              }}
              onAddress={(text) => {
                if (!addressTouched) {
                  setAddress(text);
                  clearErr("address");
                }
              }}
            />
          </div>
          {errors.location && <span className="text-sm font-medium text-[#a33a52]">{errors.location}</span>}
          <label className="field">
            <span className="label">{c.address}</span>
            <input
              className="input"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setAddressTouched(true);
                clearErr("address");
              }}
              autoComplete="street-address"
              aria-invalid={Boolean(errors.address)}
              maxLength={300}
            />
            {errors.address && <span className="text-sm font-medium text-[#a33a52]">{errors.address}</span>}
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="field">
              <span className="label">{c.building}</span>
              <input className="input" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={60} />
            </label>
            <label className="field">
              <span className="label">{c.floor}</span>
              <input className="input" value={floor} onChange={(e) => setFloor(e.target.value)} maxLength={30} inputMode="numeric" />
            </label>
            <label className="field">
              <span className="label">{c.apartment}</span>
              <input className="input" value={apartment} onChange={(e) => setApartment(e.target.value)} maxLength={30} />
            </label>
          </div>
          <label className="field">
            <span className="label">{c.landmark}</span>
            <input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={200} />
          </label>
        </section>

        <section className={section} aria-labelledby="co-pay">
          <h2 id="co-pay" className={h2}>
            {c.pay}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="co-pay">
            {(["cod", "instapay"] as const).map((m) => (
              <label
                key={m}
                className="grid cursor-pointer gap-1 rounded-2xl border-2 border-plum/15 bg-white p-4 transition-colors has-[:checked]:border-plum has-[:checked]:bg-blush has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose"
              >
                <input type="radio" name="pay" value={m} checked={pay === m} onChange={() => setPay(m)} className="sr-only" />
                <span className="font-display text-lg font-semibold text-plum">{m === "cod" ? c.cod : c.instapay}</span>
                <span className="text-sm text-cocoa/75">{m === "cod" ? c.codHint : c.instapayHint}</span>
              </label>
            ))}
          </div>
          <label className="field">
            <span className="label">{c.note}</span>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={c.notePlaceholder} />
          </label>
          {/* Hidden from people; bots fill it. */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] size-px opacity-0"
          />
        </section>
      </div>

      <aside className="grid gap-4 rounded-[28px] bg-blush p-5 md:p-7 lg:sticky lg:top-24" aria-labelledby="co-sum">
        <div className="h-[3px] bg-[radial-gradient(circle,rgb(91_70_89/.45)_1px,transparent_1.4px)] bg-[length:6px_3px]" aria-hidden="true" />
        <h2 id="co-sum" className={h2}>
          {c.summary}
        </h2>
        <ul className="grid gap-2">
          {items.map((it) => {
            const bad = unavailable.has(it.id);
            return (
              <li key={it.key} className={`flex items-center gap-3 rounded-2xl bg-white/60 p-2.5 ${bad ? "opacity-60" : ""}`}>
                <span className="size-8 shrink-0 rounded-full shadow-[inset_-3px_-4px_0_rgb(0_0_0/.13)]" style={{ background: it.color ?? "#5b4659" }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-display font-semibold text-plum">
                    {it.qty > 1 ? `${number(it.qty, lang)} × ` : ""}
                    {loc(it, "name", lang)}
                  </b>
                  <span className="text-sm text-cocoa/70">{bad ? c.notAvailable : loc(it, "label", lang)}</span>
                </span>
                {bad ? (
                  <button type="button" onClick={() => setQty(it.key, 0)} className="text-sm font-semibold text-rose underline underline-offset-4">
                    {c.removeItem}
                  </button>
                ) : (
                  <span className="font-semibold tabular-nums">{money(it.price * it.qty, lang)}</span>
                )}
              </li>
            );
          })}
        </ul>

        {outOfStock.length > 0 && (
          <p className="rounded-2xl bg-rose/15 px-4 py-3 text-sm font-medium text-[#a33a52]">
            {outOfStock.map((e) => c.errors.out_of_stock(lang === "ar" ? (e.name_ar ?? "") : (e.name_en ?? ""))).join(" ")}
          </p>
        )}

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-plum">{c.code}</span>
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1 uppercase"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setCodeMsg(null);
                  setCode(codeInput.trim().toUpperCase());
                }
              }}
              aria-label={c.code}
              maxLength={40}
              dir="ltr"
            />
            {code ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCode("");
                  setCodeInput("");
                  setCodeMsg(null);
                }}
              >
                {c.remove}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!codeInput.trim()}
                onClick={() => {
                  setCodeMsg(null);
                  setCode(codeInput.trim().toUpperCase());
                }}
              >
                {c.apply}
              </button>
            )}
          </div>
          {codeMsg && (
            <span className={`text-sm font-medium ${quote?.discount ? "text-[#4d5a33]" : "text-[#a33a52]"}`} role="status">
              {codeMsg}
            </span>
          )}
        </div>

        <dl className="grid gap-2 border-t border-plum/15 pt-4 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt>{c.subtotal}</dt>
            <dd className="tabular-nums">{money(quote?.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0), lang)}</dd>
          </div>
          {quote && quote.discount_total > 0 && (
            <div className="flex justify-between gap-3 text-[#4d5a33]">
              <dt>{c.discount}</dt>
              <dd className="tabular-nums">−{money(quote.discount_total, lang)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt>
              {c.delivery}
              {quote?.distance_km != null && <span className="block text-xs text-cocoa/60">{c.distance(number(quote.distance_km, lang))}</span>}
            </dt>
            <dd className="text-end tabular-nums">
              {!pin || !quote?.has_location ? (
                <span className="text-sm text-cocoa/70">{c.pinFirst}</span>
              ) : quote.free_shipping ? (
                c.deliveryFree
              ) : (
                money(quote.shipping_fee, lang)
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-plum/15 pt-3">
            <dt className="font-display text-lg font-semibold text-plum">{c.total}</dt>
            <dd className="font-display text-[28px] font-semibold text-plum tabular-nums">
              {money(quote ? quote.total : items.reduce((s, i) => s + i.price * i.qty, 0), lang)}
            </dd>
          </div>
        </dl>

        {(formError || isPaused) && (
          <p role="alert" className="rounded-2xl bg-rose/15 px-4 py-3 text-sm font-medium text-[#a33a52]">
            {isPaused ? c.paused : formError}
          </p>
        )}

        <div className="sticky bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-20 lg:static">
          <button
            type="button"
            onClick={submit}
            disabled={placing || isPaused || unavailable.size > 0}
            className="w-full rounded-full bg-plum px-6 py-4 font-display text-xl font-semibold text-blush shadow-[0_14px_28px_-12px_rgb(58_36_32/.6)] transition-colors hover:bg-plum-hover disabled:cursor-not-allowed disabled:bg-plum/40 lg:shadow-none"
          >
            {placing ? c.placing : quote ? `${c.place} · ${money(quote.total, lang)}` : c.place}
          </button>
        </div>
      </aside>
    </div>
  );
}
