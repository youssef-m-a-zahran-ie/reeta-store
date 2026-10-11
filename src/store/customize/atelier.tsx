"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCart } from "../cart";
import { track } from "../analytics";
import { dict, loc, money, number, type Lang } from "../i18n";
import type { Atelier as AtelierData, AtelierBase, AtelierCoating, AtelierSize } from "../data";
import { useCountUp } from "../components/count-up";
import { waLink, WhatsAppIcon } from "../components/whatsapp";
import { AtelierEngine, type Tier } from "./engine";
import { atelierImg, BASE_VISUALS, COATING_VISUALS, isBaseVisual, isCoatingVisual } from "./visuals";

const comboId = (b: string, c: string, z: string) => `${b}.${c}.${z}`;

/** The Atelier: a live stage on top, the three choices under it, and the price with "Add to pouch" at the end. */
export function Atelier({ data, lang, whatsapp = null }: { data: AtelierData; lang: Lang; whatsapp?: string | null }) {
  const t = dict[lang];
  const a = t.atelier;
  const { add, toast } = useCart();

  // Only choices we have photos for can be shown.
  const bases = useMemo(() => data.bases.filter((b) => isBaseVisual(b.visual) && b.sizes.length), [data.bases]);
  const coatings = useMemo(() => data.coatings.filter((c) => isCoatingVisual(c.visual) && c.prices.length), [data.coatings]);
  const soldOut = useMemo(() => new Set(data.sold_out), [data.sold_out]);

  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [coatId, setCoatId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);

  const base = bases.find((b) => b.id === baseId) ?? bases[0];
  const coat = coatings.find((c) => c.id === coatId) ?? null;

  const basePrice = (b: AtelierBase, z: string) => b.sizes.find((s) => s.size_id === z);
  const coatPrice = (c: AtelierCoating, z: string) => c.prices.find((p) => p.size_id === z)?.price;
  const sizesFor = (b: AtelierBase, c: AtelierCoating | null) =>
    data.sizes.filter((z) => basePrice(b, z.id) && (!c || coatPrice(c, z.id) !== undefined));
  const priceOf = (b: AtelierBase, c: AtelierCoating, z: string) => {
    const bp = basePrice(b, z), cp = coatPrice(c, z);
    return bp && cp !== undefined ? bp.price + cp : null;
  };
  const isSoldOut = (b: AtelierBase, c: AtelierCoating, z: string) => soldOut.has(comboId(b.id, c.id, z));

  const sizes = base ? sizesFor(base, coat) : [];
  const size = sizes.find((z) => z.id === sizeId) ?? null;
  const total = base && coat && size ? priceOf(base, coat, size.id) : null;
  const shown = useCountUp(total ?? 0, 450);
  const canAdd = Boolean(base && coat && size && total !== null && !isSoldOut(base, coat, size.id));

  /* ---------- the stage ---------- */
  const stageRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const bobRef = useRef<HTMLDivElement>(null);
  const heapRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const pourRef = useRef<HTMLCanvasElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const engine = useRef<AtelierEngine | null>(null);
  const wordId = useId().replace(/:/g, "");

  const pieceOf = (b: AtelierBase) => BASE_VISUALS[b.visual as keyof typeof BASE_VISUALS]?.piece ?? 1;
  const pourOf = (c: AtelierCoating) => COATING_VISUALS[c.visual as keyof typeof COATING_VISUALS];

  useEffect(() => {
    const els = {
      stage: stageRef.current!,
      space: spaceRef.current!,
      hero: heroRef.current!,
      bob: bobRef.current!,
      heap: heapRef.current!,
      fx: fxRef.current!,
      pour: pourRef.current!,
      floorShadow: floorRef.current!,
    };
    const e = new AtelierEngine(els, { reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    engine.current = e;
    const first = bases[0];
    if (first) e.start(first.visual, pieceOf(first));
    // Photos for every other choice load in the background, so each pick is instant.
    const idle = window.setTimeout(() => e.preload(bases.map((b) => b.visual), coatings.map((c) => c.visual)), 900);
    if (first) track("view_item", { items: [{ id: "atelier", name: "Atelier", price: 0, qty: 1 }] });
    return () => {
      window.clearTimeout(idle);
      e.destroy();
      engine.current = null;
    };
    // The engine is created once; later choices are sent to it from the click handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- choices ---------- */
  // On phones, after a first pick the next step slides into view under the stage.
  function reveal(step: number) {
    window.setTimeout(() => {
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const el = document.getElementById(`atelier-step-${step}`);
      const stage = stageRef.current;
      if (!el || !stage) return;
      const top = stage.getBoundingClientRect().bottom + 12;
      const bottom = window.innerHeight - 120;
      const r = el.getBoundingClientRect();
      if (r.top >= top && r.bottom <= bottom) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: r.top - top, behavior: reduce ? "auto" : "smooth" });
    }, 380);
  }
  function pickBase(b: AtelierBase) {
    if (b.id === baseId) {
      if (!coatId) reveal(2);
      return;
    }
    if (!coatId) reveal(2);
    const keep = size && sizesFor(b, coat).some((z) => z.id === size.id);
    if (!keep && size) {
      setSizeId(null);
      engine.current?.backToHero();
    }
    setBaseId(b.id);
    engine.current?.setBase(b.visual, pieceOf(b));
  }
  function pickCoat(c: AtelierCoating) {
    if (c.id === coatId || !base) return;
    const keep = size && sizesFor(base, c).some((z) => z.id === size.id);
    if (!keep && size) {
      setSizeId(null);
      engine.current?.backToHero();
    }
    if (!coatId || !size) reveal(3);
    setCoatId(c.id);
    engine.current?.setCoating(c.visual, pourOf(c));
  }
  function pickSize(z: AtelierSize) {
    if (!coat || z.id === sizeId) return;
    setSizeId(z.id);
    void engine.current?.setTier(z.tier as Tier);
  }
  function startOver() {
    const first = bases[0];
    setBaseId(first?.id ?? "");
    setCoatId(null);
    setSizeId(null);
    if (first) engine.current?.reset(first.visual, pieceOf(first));
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const addBtn = useRef<HTMLButtonElement>(null);
  const sizeLabel = (b: AtelierBase, z: AtelierSize, l: Lang) => {
    const bp = basePrice(b, z.id);
    const name = loc(z, "name", l);
    return b.display === "weight" && bp ? `${name} · ${number(bp.grams, l)} ${l === "ar" ? "جم" : "g"}` : name;
  };
  function onAdd() {
    if (!canAdd || !base || !coat || !size || total === null) return;
    const id = comboId(base.id, coat.id, size.id);
    add(
      {
        key: `c:${id}`,
        kind: "custom",
        id,
        slug: "customize",
        name_en: `${base.name_en} · ${coat.name_en}`,
        name_ar: `${base.name_ar} · ${coat.name_ar}`,
        label_en: sizeLabel(base, size, "en"),
        label_ar: sizeLabel(base, size, "ar"),
        price: total,
        color: coat.color,
        image: atelierImg.drip(base.visual, coat.visual),
      },
      1,
      addBtn.current,
    );
    toast(a.added(`${loc(base, "name", lang)} · ${loc(coat, "name", lang)}`));
  }

  /* ---------- labels ---------- */
  const baseFrom = (b: AtelierBase) => {
    const list = b.sizes.flatMap((s) => coatings.map((c) => coatPrice(c, s.size_id)).filter((p): p is number => p !== undefined).map((p) => s.price + p));
    return list.length ? Math.min(...list) : null;
  };
  // Best value: the lowest price per gram among the sizes on offer (only when there's a real choice).
  const bestSize = useMemo(() => {
    if (!base || !coat || base.display !== "weight") return null;
    const opts = sizes
      .map((z) => ({ z, p: priceOf(base, coat, z.id), g: basePrice(base, z.id)?.grams ?? 0 }))
      .filter((o) => o.p !== null && o.g > 0 && !isSoldOut(base, coat, o.z.id));
    if (opts.length < 2) return null;
    return opts.reduce((m, o) => (o.p! / o.g < m.p! / m.g ? o : m)).z.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, coat, sizes]);

  const summary = [base && loc(base, "name", lang), coat && loc(coat, "name", lang), base && size && sizeLabel(base, size, lang)].filter(Boolean).join(" · ");
  const sizeTierMax = Math.max(1, ...sizes.map((z) => z.tier));

  if (!base) return null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-14">
      {/* ---------- Stage ---------- */}
      <div className="sticky top-[68px] z-20 -mx-4 bg-page px-4 pt-2 pb-3 lg:top-24 lg:mx-0 lg:bg-transparent lg:p-0">
        <div ref={stageRef} className="atelier-stage" role="img" aria-label={`${a.stage}: ${summary}`}>
          <div className="atelier-frame" aria-hidden="true" />
          <div ref={floorRef} className="atelier-floor" aria-hidden="true" />
          <div ref={spaceRef} className="atelier-space" aria-hidden="true">
            <div className="bshadow" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="back" src={atelierImg.bowlBack} alt="" />
            <canvas ref={heapRef} className="heap" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="front" src={atelierImg.bowlFront} alt="" />
            {/* The logo on the bowl comes from the brand mark file, so a new logo updates here too. */}
            <span className="bowl-mark mark mark-full" />
            <svg className="bowl-word" viewBox="0 0 480 110">
              <path id={wordId} d="M 10 58 Q 240 84 470 58" fill="none" />
              <text textAnchor="middle">
                <textPath href={`#${wordId}`} startOffset="50%">
                  REETA
                </textPath>
              </text>
            </svg>
            <canvas ref={fxRef} className="fx" />
          </div>
          <div ref={heroRef} className="atelier-hero" aria-hidden="true">
            <div ref={bobRef} className="bob" />
          </div>
          <canvas ref={pourRef} className="atelier-pour" aria-hidden="true" />
        </div>
        <p className="mt-3 hidden justify-center gap-x-3 text-[13px] text-cocoa/60 lg:flex" aria-hidden="true">
          <span>{a.madeToOrder}</span>
          <span>·</span>
          <span>{a.handCoated}</span>
          <span>·</span>
          <span>{a.sealedFresh}</span>
        </p>
      </div>

      {/* ---------- Choices ---------- */}
      <div className="grid gap-9 pb-4 lg:gap-10">
        <Step id="atelier-step-1" n={1} title={a.steps[0]} value={loc(base, "name", lang)}>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={a.steps[0]}>
            {bases.map((b) => {
              const from = baseFrom(b);
              const note = loc(b, "note", lang);
              return (
                <button key={b.id} type="button" role="radio" aria-checked={b.id === base.id} onClick={() => pickBase(b)} className="atelier-opt">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream sm:size-14 sm:rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={atelierImg.bare(b.visual)} alt="" className="size-[84%] object-contain" loading="lazy" />
                  </span>
                  <span className="grid min-w-0 text-start">
                    <span className="text-[15px] leading-tight font-medium text-plum sm:text-[16px]">{loc(b, "name", lang)}</span>
                    <span className="text-[12.5px] leading-snug text-cocoa/65 tabular-nums sm:text-[13px]">{note || (from !== null ? a.from(money(from, lang)) : "")}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step id="atelier-step-2" n={2} title={a.steps[1]} value={coat ? loc(coat, "name", lang) : ""}>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={a.steps[1]}>
            {coatings.map((c) => {
              const v = pourOf(c);
              const z = size?.id ?? sizesFor(base, c)[0]?.id;
              const extra = z ? coatPrice(c, z) : undefined;
              const note = loc(c, "note", lang);
              const out = size ? isSoldOut(base, c, size.id) : sizesFor(base, c).every((s) => isSoldOut(base, c, s.id));
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === coatId}
                  onClick={() => pickCoat(c)}
                  className="atelier-opt"
                  disabled={!sizesFor(base, c).length}
                >
                  <span
                    className="ms-0.5 size-8 shrink-0 rounded-full sm:ms-1 sm:size-10 shadow-[inset_0_-4px_7px_rgb(0_0_0/.28),inset_0_3px_5px_rgb(255_255_255/.35),0_6px_12px_-6px_rgb(58_36_32/.5)]"
                    style={{ background: `radial-gradient(circle at 35% 30%, ${v.c3}, ${v.c2} 46%, ${v.c1})` }}
                    aria-hidden="true"
                  />
                  <span className="grid min-w-0 text-start">
                    <span className="text-[15px] leading-tight font-medium text-plum sm:text-[16px]">{loc(c, "name", lang)}</span>
                    <span className="text-[12.5px] leading-snug text-cocoa/65 tabular-nums sm:text-[13px]">
                      {out ? a.soldOut : note || (extra !== undefined && extra > 0 ? a.plus(money(extra, lang)) : "")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step id="atelier-step-3" n={3} title={a.steps[2]} value={size ? loc(size, "name", lang) : ""} hint={coat ? undefined : a.pickCoatingFirst} disabled={!coat}>
          <div className={`grid gap-2.5 ${sizes.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`} role="radiogroup" aria-label={a.steps[2]}>
            {sizes.map((z) => {
              const bp = basePrice(base, z.id)!;
              const p = coat ? priceOf(base, coat, z.id) : null;
              const out = coat ? isSoldOut(base, coat, z.id) : false;
              return (
                <button
                  key={z.id}
                  type="button"
                  role="radio"
                  aria-checked={z.id === sizeId}
                  aria-disabled={!coat || out}
                  disabled={!coat || out}
                  onClick={() => pickSize(z)}
                  className="atelier-opt atelier-size"
                >
                  {z.id === bestSize && <span className="atelier-badge">{a.bestValue}</span>}
                  <BowlGlyph tier={z.tier} max={sizeTierMax} />
                  <span className="text-[16px] leading-tight font-medium text-plum">{loc(z, "name", lang)}</span>
                  {base.display === "weight" && (
                    <span className="text-[13px] text-cocoa/65 tabular-nums">
                      {number(bp.grams, lang)} {a.g}
                    </span>
                  )}
                  <span className="mt-1 text-[16px] font-medium text-cocoa tabular-nums">{out ? a.soldOut : p !== null ? money(p, lang) : "—"}</span>
                </button>
              );
            })}
          </div>
        </Step>

        {/* ---------- Price and add ---------- */}
        <div className="sticky bottom-[calc(10px+env(safe-area-inset-bottom,0px))] z-20 lg:static">
          <div className="dot-grid-dark grid gap-3 rounded-[28px] bg-plum p-4 text-blush shadow-[0_18px_36px_-16px_rgb(58_36_32/.6)] md:p-6 lg:gap-4 lg:shadow-none">
            <div className="hidden gap-1 lg:grid">
              <span className="eyebrow text-blush/60">
                {a.yours}
              </span>
              <span className="min-h-[1.5em] text-[15px] text-blush/85">{summary && size ? summary : a.empty}</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="grid min-w-0 flex-1">
                <span className="truncate text-[13px] text-blush/70 lg:hidden">{size ? summary : a.yours}</span>
                <span className="text-[22px] leading-none font-medium whitespace-nowrap tabular-nums min-[380px]:text-[24px] sm:text-[26px] md:text-[32px]" aria-live="polite">
                  {total !== null ? money(shown, lang) : "—"}
                </span>
                {total !== null && size && base.display === "weight" && (
                  <span className="mt-1 hidden text-[13px] text-blush/60 tabular-nums lg:block">
                    {a.per100(money(Math.round((total / (basePrice(base, size.id)?.grams || 1)) * 100), lang))}
                  </span>
                )}
              </div>
              {whatsapp && (
                <a
                  href={waLink(whatsapp, a.waText(size ? summary : ""))}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={a.ask}
                  title={a.ask}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-sage text-white transition-transform active:scale-95 lg:hidden"
                >
                  <WhatsAppIcon className="size-6" />
                </a>
              )}
              <button
                ref={addBtn}
                type="button"
                onClick={onAdd}
                disabled={!canAdd}
                className="shrink-0 rounded-full bg-blush px-4 py-3.5 text-[15px] font-medium whitespace-nowrap text-plum min-[380px]:px-5 min-[380px]:text-[16px] sm:px-6 sm:text-[17px] transition-[background,transform,opacity] hover:bg-cream active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 md:px-8"
              >
                {canAdd ? a.add : coat ? a.chooseSize : a.add}
              </button>
            </div>
          </div>
        </div>
        <div className="-mt-5 flex justify-end lg:-mt-6">
          <button type="button" onClick={startOver} className="text-sm font-medium text-plum underline underline-offset-4 hover:text-plum-hover">
            {a.startOver}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  id,
  n,
  title,
  value,
  hint,
  disabled,
  children,
}: {
  id: string;
  n: number;
  title: string;
  value?: string;
  hint?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`grid gap-3.5 transition-opacity duration-300 ${disabled ? "opacity-45" : ""}`} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 border-b border-plum/12 pb-2.5">
        <span className="eyebrow">
          <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
          <span className="mx-2 text-toffee/50">—</span>
          {title}
        </span>
        <span className="truncate text-[14px] font-medium text-plum">{hint ?? value}</span>
      </div>
      {children}
    </section>
  );
}

/** A small bowl that grows with the size. */
function BowlGlyph({ tier, max }: { tier: number; max: number }) {
  const s = [0.62, 0.82, 1][Math.min(2, Math.max(0, tier - 1))] / [0.62, 0.82, 1][Math.min(2, Math.max(0, max - 1))];
  return (
    <svg viewBox="0 0 48 30" className="mx-auto mb-1 h-[26px] w-12 text-plum" aria-hidden="true">
      <g transform={`translate(24 28) scale(${Math.min(1, s)}) translate(-24 -28)`}>
        <ellipse cx="24" cy="12" rx="17" ry={tier >= 2 ? 7 : 5} fill="currentColor" opacity=".16" />
        <path d="M4 12h40c0 9-8.5 15-20 15S4 21 4 12Z" fill="currentColor" opacity=".9" />
        <ellipse cx="24" cy="12" rx="20" ry="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
