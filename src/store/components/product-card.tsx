"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/supabase/env";
import { useCart } from "../cart";
import { inkOn } from "../colors";
import { dict, href, loc, money, type Lang } from "../i18n";
import type { StoreProduct } from "../data";
import { useCountUp } from "./count-up";

/** How big the pouch looks for the chosen size: smallest 80%, largest 100%. */
export function sizeScale(index: number, total: number) {
  if (total <= 1) return 1;
  return 0.8 + 0.2 * (index / (total - 1));
}

export function ProductCard({ product, lang, categoryName }: { product: StoreProduct; lang: Lang; categoryName?: string }) {
  const t = dict[lang];
  const { add, toast } = useCart();
  const variants = product.variants;
  const firstAvailable = Math.max(
    0,
    variants.findIndex((v) => v.available && v.amount === 250) >= 0
      ? variants.findIndex((v) => v.available && v.amount === 250)
      : variants.findIndex((v) => v.available),
  );
  const [idx, setIdx] = useState(firstAvailable);
  const v = variants[idx];
  const price = useCountUp(v?.price ?? 0);
  const bandRef = useRef<HTMLDivElement>(null);
  const color = product.color ?? "#f5ead8";
  const ink = inkOn(color);
  const name = loc(product, "name", lang);
  const img = product.images[0];
  const link = href(lang, `/products/${product.slug}`);
  const scale = sizeScale(idx, variants.length);
  const soldOut = !variants.some((x) => x.available);

  function onAdd() {
    if (!v || !v.available) return;
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
        image: img?.path ?? null,
      },
      1,
      bandRef.current,
    );
    toast(t.cart.added(`${loc(v, "label", lang)} ${name}`));
  }

  return (
    <article className="group relative isolate grid content-start gap-4 rounded-[28px] p-3 sm:p-4" style={{ "--c": color } as React.CSSProperties}>
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-[inherit] bg-[var(--c)] opacity-0 transition-opacity duration-300 group-hover:opacity-[.14]"
      />
      <Link href={link} className="relative block" tabIndex={-1} aria-hidden="true">
        <div className="relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-[24px] bg-blush/70">
          <div
            className="flex h-full w-full items-end justify-center transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-rotate-2"
            style={{ transform: `scale(${scale})`, transformOrigin: "50% 100%" }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(img.path)!}
                alt={loc(img, "alt", lang) || name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="w-[72%] pb-[6%]">
                <div className="mx-auto aspect-[228/312] w-full rounded-[26px] bg-blush shadow-[0_18px_30px_-18px_rgb(58_36_32/.45)]">
                  <div className="grid h-full content-center justify-items-center gap-2 pb-[30%] text-plum">
                    <span className="mark mark-full size-14" />
                    <span className="font-display text-base font-semibold tracking-[0.07em]" dir="ltr">
                      REETA
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {v?.amount && (
            <span className="absolute top-3 end-3 grid size-14 rotate-6 place-items-center rounded-full bg-plum font-display text-sm font-semibold text-blush shadow-md">
              {lang === "ar" ? `${v.amount} جم` : `${v.amount}g`}
            </span>
          )}
          {soldOut && (
            <span className="absolute top-3 start-3 rounded-full bg-cocoa px-3 py-1 text-xs font-semibold text-cream">{t.product.soldOut}</span>
          )}
        </div>
      </Link>

      <div
        ref={bandRef}
        data-band=""
        data-color={color}
        className="relative -mt-14 mx-3 grid min-h-[84px] content-center gap-px overflow-hidden rounded-[20px] px-4 py-3 shadow-[0_10px_24px_-14px_rgb(58_36_32/.5)]"
        style={{ background: color, color: ink }}
      >
        {categoryName && <span className="text-xs opacity-80">{categoryName}</span>}
        <h3 className="font-display text-xl leading-tight font-semibold" style={{ color: ink }}>
          <Link href={link} className="after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
      </div>

      <div className="grid gap-3 px-1">
        {loc(product, "short", lang) && <p className="min-h-[3.2em] text-[15px] leading-relaxed text-cocoa/80">{loc(product, "short", lang)}</p>}
        {variants.length > 1 && (
          <div className="grid grid-flow-col gap-1 rounded-full bg-plum/[.07] p-1" role="radiogroup" aria-label={t.product.weight}>
            {variants.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={i === idx}
                onClick={() => setIdx(i)}
                className="relative rounded-full px-1 py-1.5 text-[13px] font-semibold text-plum transition-colors hover:bg-white/70 aria-checked:bg-plum aria-checked:text-blush disabled:opacity-40"
                title={x.available ? undefined : t.product.unavailableSize}
              >
                <span className={x.available ? "" : "line-through decoration-1"}>{loc(x, "label", lang)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-2xl leading-none font-semibold text-plum tabular-nums">
            {v ? money(price, lang) : ""}
          </span>
          <button
            type="button"
            onClick={onAdd}
            disabled={!v?.available}
            className="relative z-10 inline-flex items-center rounded-full bg-plum px-4 py-2.5 font-display text-[15px] font-semibold text-blush transition-[background,transform] hover:bg-plum-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-plum/30"
          >
            {v?.available ? t.product.addToPouch : t.product.soldOut}
          </button>
        </div>
      </div>
    </article>
  );
}
