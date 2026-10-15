import { NutPhoto } from "./nut-photo";

/** Orbit rings and floating nuts for page headers (pure CSS, no JavaScript). n = which nut photo, r = tilt. */
const NUTS = [
  { n: 4, s: 92, r: -18, top: "14%", end: "18%", d: "0s" },
  { n: 6, s: 54, r: 24, top: "62%", end: "30%", d: "-2s" },
  { n: 1, s: 74, r: 38, top: "32%", end: "5%", d: "-4s" },
  { n: 7, s: 44, r: -12, top: "74%", end: "11%", d: "-1s" },
  { n: 2, s: 48, r: 68, top: "8%", end: "3%", d: "-3s" },
  { n: 5, s: 36, r: -34, top: "50%", end: "42%", d: "-5s" },
];

export function OrbitDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute top-1/2 end-[14%] size-0 max-md:end-[8%] max-md:top-[20%]">
        <span className="spin-r absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-plum/20 max-md:size-[320px]" />
        <span className="absolute top-1/2 left-1/2 size-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-plum/15 max-md:size-[220px]" />
      </div>
      {NUTS.map((r, i) => (
        <span
          key={i}
          className={`float absolute max-md:scale-[.78] ${i % 2 ? "max-md:hidden" : ""}`}
          style={{ top: r.top, insetInlineEnd: r.end, "--fd": r.d } as React.CSSProperties}
        >
          <NutPhoto n={r.n} size={r.s} rot={r.r} />
        </span>
      ))}
    </div>
  );
}

/** A tiny orbit around the Reeta mark, for "nothing here yet" moments. */
export function EmptyOrbit({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="dot-grid grid justify-items-center gap-6 rounded-[36px] bg-cream/60 px-6 py-14 text-center">
      <div className="relative size-40" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-plum/25" />
        <span className="mark mark-full absolute inset-[30%] text-plum" />
        <span className="orbit-spin absolute inset-0">
          <span className="absolute -top-4 left-1/2 -translate-x-1/2">
            <NutPhoto n={4} size={36} rot={-20} />
          </span>
          <span className="absolute top-1/2 -right-4 -translate-y-1/2">
            <NutPhoto n={7} size={30} rot={25} />
          </span>
          <span className="absolute -bottom-4 left-[18%]">
            <NutPhoto n={5} size={32} rot={-40} />
          </span>
        </span>
      </div>
      <p className="max-w-md font-display text-[22px] font-semibold text-plum md:text-[28px]">{text}</p>
      {children}
    </div>
  );
}
