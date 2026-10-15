"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { NutArt, type NutKind } from "../menu/nut-art";

/**
 * d / m: where the nut floats in the hero (fraction of its width and height) on laptop / phone.
 * s: size in px on laptop. z: how much it follows the pointer. r: resting tilt.
 * Each nut with a plate on the page falls into it as you scroll; the rest drift away.
 */
type NutDef = { k: NutKind; s: number; d: [number, number]; m: [number, number]; z: number; r: number };

const NUTS: NutDef[] = [
  { k: "cashew", s: 112, d: [0.13, 0.34], m: [0.11, 0.1], z: 1, r: -12 },
  { k: "almond", s: 92, d: [0.84, 0.28], m: [0.89, 0.1], z: 0.85, r: 10 },
  { k: "hazelnut", s: 96, d: [0.2, 0.68], m: [0.08, 0.3], z: 0.7, r: 6 },
  { k: "macadamia", s: 100, d: [0.86, 0.64], m: [0.92, 0.32], z: 1.1, r: 0 },
  { k: "almond", s: 48, d: [0.29, 0.14], m: [0.3, 0.03], z: 0.45, r: -30 },
  { k: "hazelnut", s: 44, d: [0.73, 0.86], m: [0.7, 0.04], z: 0.5, r: 18 },
];

/** Photos of the real nuts (public/menu). A nut kind with photos shows them, one angle per floating nut; others stay cartoon. */
const HERO_PHOTOS: Partial<Record<NutKind, string[]>> = {
  hazelnut: ["/menu/hero-hazelnut-1.webp", "/menu/hero-hazelnut-2.webp"],
  almond: ["/menu/hero-almond-1.webp", "/menu/hero-almond-2.webp"],
  cashew: ["/menu/hero-cashew-1.webp", "/menu/hero-cashew-2.webp"],
  macadamia: ["/menu/hero-macadamia-1.webp", "/menu/hero-macadamia-2.webp"],
};
const photoFor = (i: number) => {
  const k = NUTS[i].k;
  const list = HERO_PHOTOS[k];
  if (!list?.length) return null;
  const nth = NUTS.slice(0, i).filter((n) => n.k === k).length;
  return list[nth % list.length];
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const inOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * Wraps the hero and the menu below it. The cartoon nuts float around the logo, follow the
 * pointer, and drop into their own plate as you scroll down.
 */
export function OrbitStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const nutRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const hero = stage.querySelector<HTMLElement>("[data-hero]");
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const els = NUTS.map((n, i) => ({ ...n, el: nutRefs.current[i]!, ph: i * 1.7, plate: null as HTMLElement | null, landed: false })).filter((n) => n.el);

    // The first nut of each kind lands on that nut's plate.
    const assignPlates = () => {
      const taken = new Set<Element>();
      for (const n of els) {
        const plate = [...stage.querySelectorAll<HTMLElement>(`[data-plate="${n.k}"]`)].find((p) => !taken.has(p) && p.offsetParent !== null) ?? null;
        n.plate = plate;
        if (plate) taken.add(plate);
      }
    };
    assignPlates();

    let mx = 0,
      my = 0,
      tx = 0,
      ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", assignPlates);

    const introStart = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      const sr = stage.getBoundingClientRect();
      const hr = hero.getBoundingClientRect();
      const vh = window.innerHeight;
      const narrow = window.innerWidth < 760;
      const sy = window.scrollY;
      const rtl = document.documentElement.dir === "rtl";
      const introE = reduce ? 1 : 1 - Math.pow(1 - clamp((now - introStart - 200) / 1400), 3);
      const t = now / 1000;

      for (const n of els) {
        const pos = narrow ? n.m : n.d;
        const px = rtl ? 1 - pos[0] : pos[0];
        const base = narrow ? n.s * 0.6 : n.s;
        const x0 = hr.left - sr.left + px * hr.width;
        const y0 = hr.top - sr.top + pos[1] * hr.height;
        let x = x0,
          y = y0,
          size = base,
          op = 1,
          rot = n.r,
          p = 0;

        if (n.plate && !reduce) {
          const br = n.plate.getBoundingClientRect();
          const x1 = br.left - sr.left + br.width / 2;
          const y1 = br.top - sr.top + br.height * 0.5;
          // Lands once its plate is a little above the bottom of the screen, so the plate is clear before you reach it.
          const end = Math.max(220, br.top + sy + br.height / 2 - vh * 0.86);
          p = clamp(sy / end);
          x = x0 + (x1 - x0) * (1 - Math.pow(1 - p, 2.2));
          y = y0 + (y1 - y0) * inOut(p);
          size = base + (br.width * 0.3 - base) * inOut(p);
          rot = n.r + 300 * inOut(p) * (px < 0.5 ? 1 : -1);
          op = 1 - clamp((p - 0.88) / 0.1);
          if (p > 0.97 && !n.landed) {
            n.landed = true;
            n.plate.classList.remove("plate-catch");
            void n.plate.offsetWidth;
            n.plate.classList.add("plate-catch");
          }
          if (p < 0.88) n.landed = false;
        } else if (!reduce) {
          p = clamp(sy / 520);
          x = x0 + (px < 0.5 ? -90 : 90) * p;
          y = y0 - 180 * p;
          op = 1 - p;
        }

        if (!reduce) {
          const free = 1 - p;
          x += (mx * 46 * n.z + Math.sin(t * 0.7 + n.ph) * 9) * free;
          y += (my * 34 * n.z + Math.cos(t * 0.6 + n.ph) * 13) * free;
          rot += Math.sin(t * 0.5 + n.ph) * 6 * free;
          const hx = hr.left - sr.left + hr.width / 2;
          const hy = hr.top - sr.top + hr.height * 0.44;
          x = hx + (x - hx) * (0.55 + 0.45 * introE);
          y = hy + (y - hy) * (0.55 + 0.45 * introE);
          size *= 0.4 + 0.6 * introE;
          op *= introE;
        }
        n.el.style.width = n.el.style.height = `${size}px`;
        n.el.style.opacity = String(op);
        n.el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${rot}deg)`;
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResizeStatic = () => reduce && requestAnimationFrame(frame);
    window.addEventListener("resize", onResizeStatic);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", assignPlates);
      window.removeEventListener("resize", onResizeStatic);
    };
  }, []);

  return (
    <div ref={stageRef} className="relative">
      <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
        {NUTS.map((n, i) => (
          <div
            key={i}
            ref={(el) => {
              nutRefs.current[i] = el;
            }}
            className="hero-nut absolute top-0 left-0 opacity-0 will-change-transform"
          >
            {photoFor(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoFor(i)!} alt="" draggable={false} className="size-full object-contain drop-shadow-[0_6px_10px_rgba(90,51,34,.25)]" />
            ) : (
              <NutArt kind={n.k} className="size-full" />
            )}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
