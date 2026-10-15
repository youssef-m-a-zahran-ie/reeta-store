"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../cart";
import { track } from "../analytics";
import { dict, href, loc, money, number, type Lang } from "../i18n";
import type { Menu as MenuData, MenuBase, MenuCoating, MenuSize } from "../data";
import { isNutKind, NutArt } from "./nut-art";
import { cutoutOf, plateImage } from "./visuals";

const comboId = (b: string, c: string, z: string) => `${b}.${c}.${z}`;
// How big the plate looks for each size (custom_sizes.tier). Before a size is picked: medium.
const SCALE: Record<number, number> = { 1: 0.8, 2: 0.9, 3: 1 };

/**
 * The whole shop on one page: four plates in a 2 × 2 grid. Tapping a plate opens a bottom sheet
 * (phones) or fills the side panel (laptop) with sauce, size and how many, then Add.
 */
export function Menu({ data, lang }: { data: MenuData; lang: Lang }) {
  const t = dict[lang].menu;
  const cart = useCart();

  const bases = useMemo(() => data.bases.filter((b) => b.sizes.length), [data.bases]);
  const coatings = useMemo(() => data.coatings.filter((c) => c.prices.length), [data.coatings]);
  const soldOut = useMemo(() => new Set(data.sold_out), [data.sold_out]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [coatId, setCoatId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [wide, setWide] = useState(false);

  const base = bases.find((b) => b.id === openId) ?? null;
  const coat = coatings.find((c) => c.id === coatId) ?? null;

  /* ---------- prices ---------- */
  const basePrice = (b: MenuBase, z: string) => b.sizes.find((s) => s.size_id === z);
  const coatPrice = (c: MenuCoating, z: string) => c.prices.find((p) => p.size_id === z)?.price;
  const priceOf = (b: MenuBase, c: MenuCoating, z: string) => {
    const bp = basePrice(b, z);
    const cp = coatPrice(c, z);
    return bp && cp !== undefined ? bp.price + cp : null;
  };
  // Price shown under a size: with the chosen sauce, or the cheapest sauce until one is chosen.
  const sizePrice = (b: MenuBase, z: string) => {
    if (coat) return priceOf(b, coat, z);
    const list = coatings.map((c) => priceOf(b, c, z)).filter((p): p is number => p !== null);
    return list.length ? Math.min(...list) : null;
  };
  const fromPrice = (b: MenuBase) => {
    const list = b.sizes.map((s) => sizePrice(b, s.size_id)).filter((p): p is number => p !== null);
    return list.length ? Math.min(...list) : null;
  };
  const sizesFor = (b: MenuBase) => data.sizes.filter((z) => basePrice(b, z.id) && (!coat || coatPrice(coat, z.id) !== undefined));
  const isOut = (b: MenuBase, c: MenuCoating, z: string) => soldOut.has(comboId(b.id, c.id, z));

  const sizes = base ? sizesFor(base) : [];
  const size = sizes.find((z) => z.id === sizeId) ?? null;
  const unit = base && coat && size ? priceOf(base, coat, size.id) : null;
  const out = Boolean(base && coat && size && isOut(base, coat, size.id));
  const canAdd = unit !== null && !out;

  const sizeLabel = (b: MenuBase, z: MenuSize, l: Lang) => {
    const bp = basePrice(b, z.id);
    return b.display === "weight" && bp ? `${number(bp.grams, l)} ${dict[l].menu.g}` : loc(z, "name", l);
  };

  /* ---------- open / close ---------- */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lastPlate = useRef<HTMLButtonElement | null>(null);
  const sheetOpen = !wide && base !== null;

  function open(b: MenuBase, from: HTMLButtonElement) {
    lastPlate.current = from;
    if (b.id !== openId) {
      setCoatId(null);
      setSizeId(null);
      setQty(1);
    }
    setOpenId(b.id);
    track("view_item", { items: [{ id: b.id, name: b.name_en, price: fromPrice(b) ?? 0, qty: 1 }] });
    if (wide) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const close = useCallback(() => {
    setOpenId(null);
    lastPlate.current?.focus({ preventScroll: true });
  }, []);

  // While the sheet is up: lock the page, Escape closes, focus moves into the sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const f = window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(f);
    };
  }, [sheetOpen, close]);

  // Swipe the sheet down to close it.
  const drag = useRef<{ y: number; dy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) {
    if (wide) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panelRef.current?.setAttribute("data-dragging", "");
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panelRef.current?.style.setProperty("--drag", `${drag.current.dy}px`);
  }
  function onDragEnd() {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panelRef.current?.removeAttribute("data-dragging");
    panelRef.current?.style.removeProperty("--drag");
    if (dy > 90) close();
  }

  /* ---------- add ---------- */
  const addBtn = useRef<HTMLButtonElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onAdd() {
    if (!base || !coat || !size || unit === null || !canAdd) return;
    const id = comboId(base.id, coat.id, size.id);
    const img = plateImage(base, coat);
    cart.add(
      {
        key: `c:${id}`,
        kind: "custom",
        id,
        slug: "",
        name_en: `${base.name_en} · ${coat.label_en}`,
        name_ar: `${base.name_ar} · ${coat.label_ar}`,
        label_en: sizeLabel(base, size, "en"),
        label_ar: sizeLabel(base, size, "ar"),
        price: unit,
        color: coat.color,
        image: img ? cutoutOf(img.src) : null,
      },
      qty,
      addBtn.current,
    );
    const msg = `${t.added} · ${money(unit * qty, lang)}`;
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
    if (wide) {
      cart.toast(`${t.added}: ${loc(base, "name", lang)} · ${loc(coat, "label", lang)} · ${sizeLabel(base, size, lang)} × ${number(qty, lang)}`);
      setCoatId(null);
      setSizeId(null);
      setQty(1);
    } else {
      close();
    }
  }
  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  // Pouches of each nut already in the cart, for the badge on its plate.
  const inCart = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of cart.items) if (i.kind === "custom") m.set(i.id.split(".")[0], (m.get(i.id.split(".")[0]) ?? 0) + i.qty);
    return m;
  }, [cart.items]);

  /* ---------- the button that says what's next ---------- */
  const cta = !coat ? t.chooseSauce : !size ? t.chooseSize : out ? t.soldOut : unit !== null ? t.add(money(unit * qty, lang)) : t.chooseSize;

  if (!bases.length) return null;
  const scale = SCALE[size?.tier ?? 2] ?? 0.9;

  return (
    <>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:gap-10">
        {/* ---------- The plates ---------- */}
        <div className="reveal-group grid grid-cols-2 gap-3 sm:gap-4">
          {bases.map((b) => {
            const img = plateImage(b, null);
            const from = fromPrice(b);
            const n = inCart.get(b.id) ?? 0;
            return (
              <button
                key={b.id}
                type="button"
                className="plate-card"
                aria-pressed={openId === b.id}
                aria-haspopup={wide ? undefined : "dialog"}
                onClick={(e) => open(b, e.currentTarget)}
              >
                {n > 0 && (
                  <span className="plate-badge num" aria-label={t.inCart(n)}>
                    {number(n, lang)}
                  </span>
                )}
                <span className="plate" data-plate={b.visual}>
                  {img?.kind !== "photo" && <span className="plate-disc" aria-hidden="true" />}
                  <PlateVisual base={b} img={img} />
                </span>
                <span className="eyebrow text-cocoa">{loc(b, "name", lang)}</span>
                {from !== null && <span className="text-[14px] text-cocoa/70 tabular-nums">{t.from(money(from, lang))}</span>}
              </button>
            );
          })}
        </div>

        {/* ---------- Sheet (phones) / panel (laptop) ---------- */}
        <div className="menu-scrim" data-open={sheetOpen ? "" : undefined} onClick={close} aria-hidden="true" />
        <div
          ref={panelRef}
          className="menu-panel md:sticky md:top-24 md:rounded-[30px] md:bg-cream/70 md:p-2"
          data-open={sheetOpen ? "" : undefined}
          role={wide ? "region" : "dialog"}
          aria-modal={wide ? undefined : true}
          aria-labelledby="menu-panel-title"
          aria-hidden={!wide && !sheetOpen ? true : undefined}
          inert={!wide && !sheetOpen ? true : undefined}
        >
          {/* Handle: drag down to close */}
          <div
            className="menu-handle grid cursor-grab touch-none place-items-center pt-3 pb-2"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <span className="h-1.5 w-11 rounded-full bg-cocoa/15" />
          </div>

          {base ? (
            <>
              <div className="overflow-y-auto overscroll-contain px-5 pb-4 md:px-5 md:pt-4">
                {/* Head: the plate changes with the sauce and grows with the size */}
                <div className="flex items-center gap-4 md:grid md:justify-items-center md:gap-2 md:text-center">
                  <div className="relative grid size-[124px] flex-none place-items-center md:size-[200px]">
                    <span className="absolute inset-0 grid place-items-center transition-transform duration-500 ease-[cubic-bezier(.34,1.4,.5,1)]" style={{ transform: `scale(${scale})` }}>
                      {plateImage(base, coat)?.kind !== "photo" && <span className="plate-disc" aria-hidden="true" />}
                      <PlateVisual key={`${base.id}.${coat?.id ?? ""}`} base={base} img={plateImage(base, coat)} fade />
                    </span>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <h3 id="menu-panel-title" ref={titleRef} tabIndex={-1} className="text-[30px] leading-tight font-semibold outline-none md:text-[34px]">
                      {loc(base, "name", lang)}
                    </h3>
                    <p className="min-h-[1.4em] text-[14px] text-cocoa/70">
                      {[coat && loc(coat, "label", lang), size && sizeLabel(base, size, lang)].filter(Boolean).join(" · ") || loc(base, "note", lang)}
                    </p>
                  </div>
                  <button type="button" onClick={close} className="menu-close grid size-11 flex-none place-items-center self-start rounded-full bg-cream text-cocoa" aria-label={t.close}>
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                {/* Sauce */}
                <fieldset className="mt-5 grid gap-2.5">
                  <legend className="eyebrow mb-2.5">{t.sauce}</legend>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.sauce}>
                    {coatings.map((c) => {
                      const avail = base.sizes.some((s) => coatPrice(c, s.size_id) !== undefined);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={c.id === coatId}
                          disabled={!avail}
                          className="choice"
                          onClick={() => {
                            setCoatId(c.id);
                            if (size && coatPrice(c, size.id) === undefined) setSizeId(null);
                          }}
                        >
                          <span className="choice-dot" style={{ background: c.color }} aria-hidden="true" />
                          <span className="truncate">{loc(c, "label", lang)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Size */}
                <fieldset className="mt-5 grid gap-2.5">
                  <legend className="eyebrow mb-2.5">{t.size}</legend>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.size}>
                    {sizes.map((z) => {
                      const p = sizePrice(base, z.id);
                      const zOut = coat ? isOut(base, coat, z.id) : false;
                      return (
                        <button
                          key={z.id}
                          type="button"
                          role="radio"
                          aria-checked={z.id === sizeId}
                          disabled={zOut}
                          className="choice choice-size"
                          onClick={() => setSizeId(z.id)}
                        >
                          <span className="text-[17px] font-semibold tabular-nums">{sizeLabel(base, z, lang)}</span>
                          <span className="text-[13px] tabular-nums opacity-75">{zOut ? t.soldOut : p !== null ? money(p, lang) : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              {/* Footer: how many + add */}
              <div className="flex items-center gap-2.5 border-t border-line bg-page px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:rounded-b-[24px] md:border-0 md:bg-transparent md:pb-4">
                <div className="flex h-[52px] flex-none items-center rounded-full border-[1.5px] border-cocoa/15 bg-[#fffaf2]" role="group" aria-label={t.qty}>
                  <button type="button" className="grid h-full w-11 place-items-center rounded-full text-xl text-cocoa disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t.less}>
                    −
                  </button>
                  <span className="num w-6 text-center text-[17px] font-semibold" aria-live="polite">
                    {number(qty, lang)}
                  </span>
                  <button type="button" className="grid h-full w-11 place-items-center rounded-full text-xl text-cocoa disabled:opacity-30" onClick={() => setQty((q) => Math.min(20, q + 1))} disabled={qty >= 20} aria-label={t.more}>
                    +
                  </button>
                </div>
                <button
                  ref={addBtn}
                  type="button"
                  onClick={onAdd}
                  aria-disabled={!canAdd}
                  className={`h-[52px] min-w-0 flex-1 truncate rounded-full px-4 text-[15px] font-semibold tabular-nums transition-colors ${
                    canAdd ? "lift bg-plum text-blush hover:bg-plum-hover" : "cursor-default bg-cocoa/10 text-cocoa/70"
                  }`}
                >
                  {cta}
                </button>
              </div>
            </>
          ) : (
            <div className="hidden justify-items-center gap-4 px-6 py-14 text-center md:grid">
              <div className="flex -space-x-3" aria-hidden="true">
                {bases.filter((b) => isNutKind(b.visual)).map((b, i) => (
                  <span key={b.id} className="float block size-14" style={{ "--fd": `${-i * 0.8}s` } as React.CSSProperties}>
                    {isNutKind(b.visual) && <NutArt kind={b.visual} className="size-full" />}
                  </span>
                ))}
              </div>
              <p id="menu-panel-title" className="font-display text-[24px] font-semibold text-plum">
                {t.pick}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Cart pill (phones) ---------- */}
      <div className="cart-pill" data-show={cart.count > 0 && !sheetOpen ? "" : undefined} aria-hidden={cart.count === 0 || sheetOpen}>
        <button type="button" className="min-w-0 flex-1 truncate text-start text-[15px] font-medium tabular-nums" onClick={() => cart.setOpen(true)} tabIndex={cart.count && !sheetOpen ? 0 : -1}>
          <span aria-live="polite">{flash ?? `${t.pouches(cart.count)} · ${money(cart.subtotal, lang)}`}</span>
        </button>
        <Link href={href(lang, "/checkout")} className="flex-none rounded-full bg-cream px-5 py-3 text-[15px] font-semibold text-cocoa" tabIndex={cart.count && !sheetOpen ? 0 : -1}>
          {dict[lang].cart.checkout}
        </Link>
      </div>
    </>
  );
}

function PlateVisual({ base, img, fade = false }: { base: MenuBase; img: ReturnType<typeof plateImage>; fade?: boolean }) {
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img.src} alt="" width={800} height={800} decoding="async" className={`plate-img ${img.kind === "piece" ? "is-piece" : ""} ${fade ? "fade-in" : ""}`} draggable={false} />;
  }
  return isNutKind(base.visual) ? <NutArt kind={base.visual} className={`plate-img is-piece ${fade ? "fade-in" : ""}`} /> : null;
}
