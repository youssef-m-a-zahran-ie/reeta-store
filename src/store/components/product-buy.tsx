"use client";

import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/supabase/env";
import { useCart } from "../cart";
import { inkOn } from "../colors";
import { dict, loc, money, type Lang } from "../i18n";
import type { StoreProductFull } from "../data";
import { useCountUp } from "./count-up";
import { sizeScale } from "./product-card";

/** Gallery + size picker + add to pouch. The pouch grows with the size you pick. */
export function ProductBuy({ product, lang }: { product: StoreProductFull; lang: Lang }) {
  const t = dict[lang];
  const { add, toast } = useCart();
  const vs = product.variants;
  const pref = vs.findIndex((v) => v.available && v.amount === 250);
  const [idx, setIdx] = useState(pref >= 0 ? pref : Math.max(0, vs.findIndex((v) => v.available)));
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const v = vs[idx];
  const price = useCountUp((v?.price ?? 0) * qty);
  const addBtn = useRef<HTMLButtonElement>(null);
  const color = product.color ?? "#f5ead8";
  const name = loc(product, "name", lang);
  const images = product.images;
  const scale = sizeScale(idx, vs.length);

  function onAdd() {
    if (!v?.available) return;
    add(
      {
        key: `v:${v.id}`,
        kind: "variant",
        id: v.id,
        slug: product.slug,
        name_en: product.name_en,
        name_ar: product.name_ar,
        label_en: v.label_en,
        label_ar: v.label_ar,
        price: v.price,
        color: product.color,
        image: images[0]?.path ?? null,
      },
      qty,
      addBtn.current,
    );
    toast(t.cart.added(`${qty > 1 ? `${qty} × ` : ""}${loc(v, "label", lang)} ${name}`));
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
      <div className="grid gap-3 lg:sticky lg:top-24">
        <div className="relative flex aspect-square items-end justify-center overflow-hidden rounded-[32px] bg-blush/80">
          <div
            className="flex h-full w-full items-end justify-center transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `scale(${images.length ? 0.9 + 0.1 * ((scale - 0.8) / 0.2) : scale})`, transformOrigin: "50% 100%" }}
          >
            {images.length ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(images[photo].path)!} alt={loc(images[photo], "alt", lang) || name} className="size-full object-cover" />
            ) : (
              <div className="w-[52%] pb-[7%]">
                <div className="grid aspect-[228/312] w-full grid-rows-[auto_1fr_auto] rounded-[28px] bg-blush px-[5%] pt-[6%] pb-[4%] shadow-[0_24px_40px_-20px_rgb(58_36_32/.5)]">
                  <div className="mx-[4%] h-[3px] bg-[radial-gradient(circle,rgb(91_70_89/.45)_1px,transparent_1.4px)] bg-[length:6px_3px]" />
                  <div className="grid content-center justify-items-center gap-2 text-plum">
                    <span className="mark mark-full size-20" aria-hidden="true" />
                    <span className="font-display text-xl font-semibold tracking-[0.07em]" dir="ltr">
                      REETA
                    </span>
                  </div>
                  <div className="grid gap-px rounded-[20px] px-[8%] py-[7%]" style={{ background: color, color: inkOn(color) }}>
                    <span className="text-xs opacity-80">{loc(product, "category_name", lang)}</span>
                    <span className="font-display text-lg leading-tight font-semibold">{name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {v?.amount && (
            <span className="absolute top-4 end-4 grid size-16 rotate-6 place-items-center rounded-full bg-plum font-display font-semibold text-blush shadow-md">
              {lang === "ar" ? `${v.amount} جم` : `${v.amount}g`}
            </span>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
            {images.map((im, i) => (
              <button
                key={im.path}
                type="button"
                role="tab"
                aria-selected={i === photo}
                onClick={() => setPhoto(i)}
                className="size-20 shrink-0 overflow-hidden rounded-2xl border-2 border-transparent aria-selected:border-plum"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(im.path)!} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid content-start gap-6">
        <div className="grid gap-3">
          <span className="eyebrow">{[loc(product, "category_name", lang), loc(product, "coating_name", lang)].filter(Boolean).join(" · ")}</span>
          <h1 className="text-[40px] leading-[1.08] font-semibold md:text-[56px]">{name}</h1>
          {loc(product, "short", lang) && <p className="text-lg text-cocoa/85">{loc(product, "short", lang)}</p>}
        </div>

        {vs.length > 1 && (
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-plum">{t.product.weight}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.product.weight}>
              {vs.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={i === idx}
                  onClick={() => setIdx(i)}
                  className="grid gap-0.5 rounded-2xl border-2 border-plum/15 bg-white/70 px-3 py-2.5 text-start transition-colors hover:border-plum/40 aria-checked:border-plum aria-checked:bg-blush"
                >
                  <span className={`font-display text-lg font-semibold text-plum ${x.available ? "" : "line-through decoration-1 opacity-60"}`}>
                    {loc(x, "label", lang)}
                  </span>
                  <span className="text-sm text-cocoa/70 tabular-nums">{x.available ? money(x.price, lang) : t.product.soldOut}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 rounded-full border-2 border-plum/15 bg-white/70 p-1" role="group" aria-label={t.product.qty}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid size-10 place-items-center rounded-full text-xl font-semibold text-plum hover:bg-blush"
              aria-label={t.product.decrease}
            >
              −
            </button>
            <span className="min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              className="grid size-10 place-items-center rounded-full text-xl font-semibold text-plum hover:bg-blush"
              aria-label={t.product.increase}
            >
              +
            </button>
          </div>
          <span className="font-display text-[32px] leading-none font-semibold text-plum tabular-nums">{v ? money(price, lang) : ""}</span>
        </div>

        {/* On phones the button sticks to the bottom of the screen. */}
        <div className="sticky bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-20 lg:static">
          <button
            ref={addBtn}
            type="button"
            onClick={onAdd}
            disabled={!v?.available}
            className="w-full rounded-full bg-plum px-6 py-4 font-display text-xl font-semibold text-blush shadow-[0_14px_28px_-12px_rgb(58_36_32/.6)] transition-[background,transform] hover:bg-plum-hover active:scale-[.98] disabled:cursor-not-allowed disabled:bg-plum/35 lg:shadow-none"
          >
            {v?.available ? t.product.addToPouch : t.product.unavailableSize}
          </button>
        </div>
      </div>
    </div>
  );
}
