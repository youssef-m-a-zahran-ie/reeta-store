export type Unit = "money" | "count" | "percent" | "grams" | "text";

const n0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function fmtValue(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (unit) {
    case "money": return `${n2.format(v)} EGP`;
    case "percent": return `${n2.format(v)}%`;
    case "grams": return Math.abs(v) >= 1000 ? `${n2.format(v / 1000)} kg` : `${n2.format(v)} g`;
    default: return n0.format(v);
  }
}

/** Short axis labels: 12.5K, 3M. */
export function fmtAxis(v: number, unit: Unit): string {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : a >= 1e4 ? `${Math.round(v / 1e3)}K` : a >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : String(Math.round(v * 10) / 10);
  return unit === "percent" ? `${s}%` : s;
}

/** Percent change, or null when there is nothing to compare with. */
export function pctChange(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || !prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

export function niceTicks(max: number, min = 0): { lo: number; hi: number; ticks: number[] } {
  if (max <= min) return { lo: min, hi: min + 4, ticks: [0, 1, 2, 3, 4].map((i) => min + i) };
  const raw = (max - min) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = lo + step * 4 >= max ? lo + step * 4 : Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 1000; t += step) ticks.push(+t.toFixed(6));
  return { lo, hi, ticks };
}

/** Brand data colors, validated for color-vision differences (scripts/validate_palette.js, light surface #fff).
 *  Single series use the brand plum itself; categories take these in order and fold the rest into "Other". */
export const SERIES = {
  main: "#5b4659",
  compare: "rgb(91 70 89 / .38)",
  cat: ["#7e387b", "#cf5973", "#91ab47", "#b06f35"],
  other: "#a99da6",
  grid: "rgb(91 70 89 / .12)",
  axis: "rgb(91 70 89 / .3)",
} as const;
