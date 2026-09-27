"use client";

import Link from "next/link";
import { useRef } from "react";
import { mediaUrl } from "@/lib/supabase/env";
import { useCart } from "../cart";
import { dict, href, loc, money, type Lang } from "../i18n";
import type { StoreBundle } from "../data";

/** The plum gift box from the brand guidelines; the lid lifts to show the pouches inside. */
export function BundleBox({ bundle, className = "" }: { bundle: StoreBundle; className?: string }) {
  const minis = bundle.items.slice(0, 3);
  const img = bundle.images[0];
  if (img) {
    return (
      <div className={`overflow-hidden rounded-[24px] bg-blush ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(img.path)!} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className={`relative flex h-[250px] items-end justify-center ${className}`} aria-hidden="true">
      <div className="absolute bottom-[112px] z-[1] flex gap-3">
        {minis.map((m, i) => (
          <div
            key={i}
            className="grid h-[84px] w-[60px] translate-y-10 items-end rounded-[14px] bg-blush p-[5px] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-6 group-focus-within:-translate-y-6"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <i className="block h-[26px] rounded-[9px]" style={{ background: m.color ?? "#f5ead8" }} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-[152px] z-[3] h-[26px] w-[258px] rounded-[14px] bg-plum-hover transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-14 group-hover:-rotate-6 group-focus-within:-translate-y-14 group-focus-within:-rotate-6" />
      <div className="relative z-[2] grid h-[164px] w-[244px] place-items-center rounded-[24px] bg-plum bg-[radial-gradient(circle,rgb(242_208_227/.16)_1.2px,transparent_1.6px)] bg-[length:17px_17px] text-blush shadow-[0_22px_34px_-20px_rgb(58_36_32/.6)]">
        <div className="grid justify-items-center gap-1.5">
          <span className="mark mark-full size-12" />
          <span className="font-display text-sm font-semibold tracking-[0.07em]" dir="ltr">
            REETA
          </span>
        </div>
      </div>
    </div>
  );
}

export function BundleCard({ bundle, lang, headingLevel = "h3" }: { bundle: StoreBundle; lang: Lang; headingLevel?: "h2" | "h3" }) {
  const t = dict[lang];
  const { add, toast } = useCart();
  const btn = useRef<HTMLButtonElement>(null);
  const name = loc(bundle, "name", lang);
  const save = bundle.separate_price !== null ? bundle.separate_price - bundle.price : 0;
  const H = headingLevel;
  const link = href(lang, `/bundles/${bundle.slug}`);

  return (
    <article className="group grid gap-6 rounded-[32px] bg-cream p-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-center md:gap-10 md:p-9">
      <BundleBox bundle={bundle} />
      <div className="grid justify-items-start gap-4">
        <H className="text-[26px] leading-tight font-semibold md:text-[32px]">
          <Link href={link} className="hover:underline hover:underline-offset-4">
            {name}
          </Link>
        </H>
        {loc(bundle, "description", lang) && <p className="max-w-prose text-cocoa/80">{loc(bundle, "description", lang)}</p>}
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold text-plum">{t.bundles.contents}</span>
          <ul className="grid gap-1.5">
            {bundle.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[16px]">
                <span
                  className="size-[18px] shrink-0 rounded-full shadow-[inset_-2px_-3px_0_rgb(0_0_0/.13)]"
                  style={{ background: it.color ?? "#f5ead8" }}
                  aria-hidden="true"
                />
                <span>
                  {it.qty > 1 ? `${it.qty} × ` : ""}
                  {loc(it, "label", lang)} {loc(it, "name", lang)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {save > 0 && <span className="rounded-full bg-rose px-3.5 py-1 text-[15px] font-semibold text-white">{t.bundles.save(money(save, lang))}</span>}
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[28px] leading-none font-semibold text-plum tabular-nums">{money(bundle.price, lang)}</span>
          {save > 0 && bundle.separate_price !== null && (
            <span className="text-cocoa/55 tabular-nums line-through">{money(bundle.separate_price, lang)}</span>
          )}
        </div>
        <button
          ref={btn}
          type="button"
          disabled={!bundle.available}
          onClick={() => {
            add(
              {
                key: `b:${bundle.id}`,
                kind: "bundle",
                id: bundle.id,
                slug: bundle.slug,
                name_en: bundle.name_en,
                name_ar: bundle.name_ar,
                label_en: null,
                label_ar: null,
                price: bundle.price,
                color: "#5b4659",
                image: bundle.images[0]?.path ?? null,
              },
              1,
              btn.current,
            );
            toast(t.cart.added(name));
          }}
          className="rounded-full bg-plum px-6 py-3 font-display text-[17px] font-semibold text-blush transition-colors hover:bg-plum-hover disabled:cursor-not-allowed disabled:bg-plum/30"
        >
          {bundle.available ? t.bundles.add : t.bundles.unavailable}
        </button>
      </div>
    </article>
  );
}
