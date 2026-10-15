/** Orbit rings and floating coated rounds for page headers (pure CSS, no JavaScript). */
const ROUNDS = [
  { c: "#3a2420", s: 58, top: "16%", end: "20%", d: "0s" },
  { c: "#a0673f", s: 34, top: "64%", end: "30%", d: "-2s" },
  { c: "#f5ead8", s: 46, top: "34%", end: "6%", d: "-4s" },
  { c: "#d9607a", s: 24, top: "78%", end: "12%", d: "-1s" },
  { c: "#8a9a62", s: 30, top: "10%", end: "4%", d: "-3s" },
  { c: "#c9955f", s: 20, top: "52%", end: "40%", d: "-5s" },
];

export function OrbitDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute top-1/2 end-[14%] size-0 max-md:end-[8%] max-md:top-[20%]">
        <span className="spin-r absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-plum/20 max-md:size-[320px]" />
        <span className="absolute top-1/2 left-1/2 size-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-plum/15 max-md:size-[220px]" />
      </div>
      {ROUNDS.map((r, i) => (
        <span
          key={i}
          className={`float absolute rounded-full ${i % 2 ? "max-md:hidden" : ""}`}
          style={
            {
              background: r.c,
              width: r.s,
              height: r.s,
              top: r.top,
              insetInlineEnd: r.end,
              "--fd": r.d,
              boxShadow: `inset -${r.s * 0.1}px -${r.s * 0.13}px 0 rgb(0 0 0 / .14), 0 ${r.s * 0.14}px ${r.s * 0.26}px rgb(58 36 32 / .18)`,
            } as React.CSSProperties
          }
        />
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
          <span className="absolute -top-2.5 left-1/2 size-5 -translate-x-1/2 rounded-full bg-cocoa shadow-[inset_-2px_-3px_0_rgb(0_0_0/.15)]" />
          <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-cream shadow-[inset_-2px_-3px_0_rgb(0_0_0/.12)]" />
          <span className="absolute -bottom-2 left-[22%] size-3.5 rounded-full bg-rose shadow-[inset_-2px_-2px_0_rgb(0_0_0/.15)]" />
        </span>
      </div>
      <p className="max-w-md font-display text-[22px] font-semibold text-plum md:text-[28px]">{text}</p>
      {children}
    </div>
  );
}
