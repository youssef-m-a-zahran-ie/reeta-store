"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RoundDef = { c: string; s: number; d: [number, number]; m: [number, number]; z: number };

// Coated rounds around the logo (brand guidelines: "Coated rounds" and "Web hero").
const ROUNDS: RoundDef[] = [
  { c: "#3a2420", s: 96, d: [0.13, 0.36], m: [0.1, 0.1], z: 1 },
  { c: "#a0673f", s: 54, d: [0.2, 0.6], m: [0.3, 0.04], z: 0.6 },
  { c: "#d9607a", s: 30, d: [0.1, 0.76], m: [0.08, 0.3], z: 0.45 },
  { c: "#8a9a62", s: 62, d: [0.82, 0.3], m: [0.88, 0.1], z: 0.8 },
  { c: "#f5ead8", s: 100, d: [0.87, 0.58], m: [0.92, 0.3], z: 1.1 },
  { c: "#c9955f", s: 34, d: [0.76, 0.8], m: [0.7, 0.04], z: 0.5 },
];

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const inOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * Wraps the hero and the product section below it. The rounds float around the logo,
 * follow the pointer, and fall into the pouch band of their color as you scroll.
 */
export function OrbitStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;
    const hero = stage.querySelector<HTMLElement>("[data-hero]");
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const els = ROUNDS.map((r, i) => {
      const el = document.createElement("div");
      el.className = "absolute top-0 left-0 rounded-full will-change-transform";
      el.style.background = r.c;
      el.style.boxShadow = `inset -${r.s * 0.09}px -${r.s * 0.11}px 0 rgb(0 0 0 / .13), 0 ${r.s * 0.06}px ${r.s * 0.12}px rgb(58 36 32 / .16)`;
      layer.appendChild(el);
      return { ...r, el, ph: i * 1.7, band: null as HTMLElement | null, landed: false };
    });

    // Each round lands on the first product band of its color.
    const assignBands = () => {
      const taken = new Set<Element>();
      const bands = [...stage.querySelectorAll<HTMLElement>("[data-band]")];
      for (const r of els) {
        r.band = bands.find((b) => !taken.has(b) && b.dataset.color?.toLowerCase() === r.c && b.offsetParent !== null) ?? null;
        if (r.band) taken.add(r.band);
      }
    };
    assignBands();

    let mx = 0,
      my = 0,
      tx = 0,
      ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", assignBands);

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

      for (const r of els) {
        const pos = narrow ? r.m : r.d;
        const px = rtl ? 1 - pos[0] : pos[0];
        const base = narrow ? r.s * 0.68 : r.s;
        const x0 = hr.left - sr.left + px * hr.width;
        const y0 = hr.top - sr.top + pos[1] * hr.height;
        let x = x0,
          y = y0,
          size = base,
          op = 1,
          p = 0;

        if (r.band && !reduce) {
          const br = r.band.getBoundingClientRect();
          const x1 = br.left - sr.left + br.width / 2;
          const y1 = br.top - sr.top + br.height / 2;
          const end = Math.max(220, br.top + sy + br.height / 2 - vh * 0.62);
          p = clamp(sy / end);
          x = x0 + (x1 - x0) * (1 - Math.pow(1 - p, 2.2));
          y = y0 + (y1 - y0) * inOut(p);
          size = base + (16 - base) * inOut(p);
          op = 1 - clamp((p - 0.9) / 0.1);
          if (p > 0.985 && !r.landed) {
            r.landed = true;
            r.band.classList.remove("band-splash");
            void r.band.offsetWidth;
            r.band.classList.add("band-splash");
          }
          if (p < 0.9) r.landed = false;
        } else if (!reduce) {
          p = clamp(sy / 520);
          x = x0 + (px < 0.5 ? -90 : 90) * p;
          y = y0 - 180 * p;
          op = 1 - p;
        }

        if (!reduce) {
          const free = 1 - p;
          const t = now / 1000;
          x += (mx * 46 * r.z + Math.sin(t * 0.7 + r.ph) * 5) * free;
          y += (my * 34 * r.z + Math.cos(t * 0.6 + r.ph) * 7) * free;
          const hx = hr.left - sr.left + hr.width / 2;
          const hy = hr.top - sr.top + hr.height * 0.44;
          x = hx + (x - hx) * (0.55 + 0.45 * introE);
          y = hy + (y - hy) * (0.55 + 0.45 * introE);
          size *= 0.4 + 0.6 * introE;
        }
        r.el.style.width = r.el.style.height = `${size}px`;
        r.el.style.opacity = String(op);
        r.el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResizeStatic = () => reduce && requestAnimationFrame(frame);
    window.addEventListener("resize", onResizeStatic);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", assignBands);
      window.removeEventListener("resize", onResizeStatic);
      els.forEach((r) => r.el.remove());
    };
  }, []);

  return (
    <div ref={stageRef} className="relative">
      <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true" />
      {children}
    </div>
  );
}
