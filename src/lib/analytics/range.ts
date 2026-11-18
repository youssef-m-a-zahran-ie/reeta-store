/** Date ranges for Analytics, in Cairo time (YYYY-MM-DD). Shared by server pages and the client date picker. */
export type CompareMode = "prev" | "year" | "none";
export type Range = { from: string; to: string; days: number; cmp: CompareMode; prevFrom: string | null; prevTo: string | null };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

export function shiftDay(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function shiftYear(day: string, years: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

export type PresetKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "365d" | "mtd" | "last_month" | "ytd";
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "365d", label: "Last 365 days" },
  { key: "mtd", label: "Month to date" },
  { key: "last_month", label: "Last month" },
  { key: "ytd", label: "Year to date" },
];

export function presetRange(key: PresetKey, today = cairoToday()): { from: string; to: string } {
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case "7d": return { from: shiftDay(today, -6), to: today };
    case "30d": return { from: shiftDay(today, -29), to: today };
    case "90d": return { from: shiftDay(today, -89), to: today };
    case "365d": return { from: shiftDay(today, -364), to: today };
    case "mtd": return { from: `${today.slice(0, 8)}01`, to: today };
    case "ytd": return { from: `${today.slice(0, 5)}01-01`, to: today };
    case "last_month": {
      const first = `${today.slice(0, 8)}01`;
      const to = shiftDay(first, -1);
      return { from: `${to.slice(0, 8)}01`, to };
    }
  }
}

export function comparisonFor(from: string, to: string, cmp: CompareMode) {
  if (cmp === "none") return { prevFrom: null, prevTo: null };
  if (cmp === "year") return { prevFrom: shiftYear(from, -1), prevTo: shiftYear(to, -1) };
  const days = daysBetween(from, to);
  return { prevFrom: shiftDay(from, -days), prevTo: shiftDay(from, -1) };
}

export function resolveRange(sp: Record<string, string | string[] | undefined>, fallback: PresetKey = "30d"): Range {
  const today = cairoToday();
  const f = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : null;
  const t = typeof sp.to === "string" && ISO.test(sp.to) ? sp.to : null;
  let from: string;
  let to: string;
  if (f && t && f <= t && t <= today && daysBetween(f, t) <= 800) {
    from = f;
    to = t;
  } else ({ from, to } = presetRange(fallback, today));
  const cmp: CompareMode = sp.cmp === "year" || sp.cmp === "none" ? sp.cmp : "prev";
  return { from, to, days: daysBetween(from, to), cmp, ...comparisonFor(from, to, cmp) };
}

export const matchPreset = (from: string, to: string) => PRESETS.find((p) => {
  const r = presetRange(p.key);
  return r.from === from && r.to === to;
})?.key;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(day: string, withYear = false) {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ""}`;
}
export function fmtRange(from: string, to: string) {
  if (from === to) return fmtDate(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmtDate(from, !sameYear)} – ${fmtDate(to, true)}`;
}

/** Day / week / month buckets for a time-series chart, so long ranges stay readable. */
export type Grain = "day" | "week" | "month";
export const grainFor = (days: number): Grain => (days > 400 ? "month" : days > 120 ? "week" : "day");
