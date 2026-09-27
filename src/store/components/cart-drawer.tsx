"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { mediaUrl } from "@/lib/supabase/env";
import { useCart } from "../cart";
import { dict, href, loc, money, type Lang } from "../i18n";

export function CartDrawer({ lang, freeOver, paused, pausedMessage }: { lang: Lang; freeOver: number | null; paused: boolean; pausedMessage: string | null }) {
  const t = dict[lang];
  const { items, subtotal, setQty, open, setOpen, toast } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, setOpen]);

  const k = freeOver ? Math.min(1, subtotal / freeOver) : 0;
  const side = lang === "ar" ? "left-0 rounded-e-[28px]" : "right-0 rounded-s-[28px]";
  const hidden = lang === "ar" ? "-translate-x-[104%]" : "translate-x-[104%]";

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-cocoa/35 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        inert={!open}
        className={`fixed top-0 bottom-0 z-50 grid w-[min(440px,100%)] grid-rows-[auto_auto_1fr_auto] bg-blush pt-[env(safe-area-inset-top,0px)] shadow-[0_0_40px_-10px_rgb(58_36_32/.4)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${side} ${open ? "translate-x-0" : hidden}`}
      >
        <div className="grid gap-3.5 px-5 pt-4 pb-1.5">
          <div className="h-[3px] bg-[radial-gradient(circle,rgb(91_70_89/.45)_1px,transparent_1.4px)] bg-[length:6px_3px]" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 id="cart-title" className="text-[28px] font-semibold">
              {t.cart.title}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-full bg-white/60 text-2xl leading-none text-plum hover:bg-cream"
              aria-label={t.nav.close}
            >
              ×
            </button>
          </div>
        </div>

        {freeOver !== null && items.length > 0 ? (
          <div className="mx-5 mb-2.5 grid gap-2 text-[15px] font-medium text-plum">
            <span>{k >= 1 ? t.cart.free : t.cart.toFree(money(freeOver - subtotal, lang))}</span>
            <div className="relative h-2.5 rounded-full bg-plum/15">
              <div
                className={`absolute inset-y-0 start-0 rounded-full transition-[width,background] duration-700 ${k >= 1 ? "bg-rose" : "bg-plum"}`}
                style={{ width: `${k * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="grid content-start gap-2.5 overflow-y-auto px-5 pt-1 pb-4">
          {items.length === 0 ? (
            <div className="grid justify-items-center gap-4 py-10 text-center text-plum">
              <div className="grid h-32 w-24 place-items-center rounded-2xl border-2 border-dashed border-plum/35">
                <span className="mark mark-full size-10 opacity-50" aria-hidden="true" />
              </div>
              <p>{t.cart.empty}</p>
              <Link
                href={href(lang, "/shop")}
                onClick={() => setOpen(false)}
                className="rounded-full border-2 border-plum px-5 py-2 font-display font-semibold text-plum hover:bg-cream"
              >
                {t.cart.emptyCta}
              </Link>
            </div>
          ) : (
            items.map((it) => {
              const name = loc(it, "name", lang);
              return (
                <div key={it.key} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-[18px] bg-white/55 p-2.5">
                  <div className="grid h-[60px] w-12 items-end overflow-hidden rounded-xl bg-page p-[3px]">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(it.image)!} alt="" className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <i className="block h-[18px] rounded-md" style={{ background: it.color ?? "#5b4659" }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <b className="block truncate font-display leading-tight font-semibold text-plum">{name}</b>
                    <small className="text-sm text-cocoa/70">
                      {[loc(it, "label", lang), money(it.price, lang)].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQty(it.key, it.qty - 1)}
                      className="grid size-8 place-items-center rounded-full border-[1.5px] border-plum/30 font-semibold text-plum hover:bg-cream"
                      aria-label={t.cart.remove(name)}
                    >
                      −
                    </button>
                    <span className="min-w-5 text-center font-semibold tabular-nums">{it.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(it.key, it.qty + 1)}
                      className="grid size-8 place-items-center rounded-full border-[1.5px] border-plum/30 font-semibold text-plum hover:bg-cream"
                      aria-label={t.cart.add(name)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`grid gap-3 bg-plum px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] text-blush ${lang === "ar" ? "rounded-se-[26px]" : "rounded-ss-[26px]"}`}>
          <div className="flex items-baseline justify-between">
            <span>{t.cart.subtotal}</span>
            <b className="font-display text-[26px] font-semibold tabular-nums">{money(subtotal, lang)}</b>
          </div>
          <p className="text-xs text-blush/75">{paused ? (pausedMessage ?? t.paused) : t.cart.deliveryNote}</p>
          <button
            type="button"
            disabled={!items.length || paused}
            onClick={() => toast(t.cart.checkoutSoon)}
            className="w-full rounded-full bg-blush px-5 py-3 font-display text-lg font-semibold text-plum transition-colors hover:bg-cream disabled:opacity-50"
          >
            {t.cart.checkout}
          </button>
        </div>
      </aside>
    </>
  );
}
