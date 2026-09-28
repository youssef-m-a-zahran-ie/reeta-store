/** Date ranges for the dashboard and reports, in Cairo time (YYYY-MM-DD). */
export const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "90d", label: "90 days" },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"] | "custom";

const cairoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d); // YYYY-MM-DD

function shift(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function resolvePeriod(sp: Record<string, string | string[] | undefined>, fallback: RangeKey = "7d") {
  const today = cairoDay(new Date());
  const raw = typeof sp.range === "string" ? sp.range : fallback;
  let key: RangeKey = (RANGES.some((r) => r.key === raw) || raw === "custom" ? raw : fallback) as RangeKey;
  let from = today;
  let to = today;
  if (key === "custom") {
    const f = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : null;
    const t = typeof sp.to === "string" && ISO.test(sp.to) ? sp.to : null;
    if (f && t && f <= t && t <= today) {
      from = f;
      to = t;
    } else key = fallback;
  }
  if (key === "7d") from = shift(today, -6);
  if (key === "30d") from = shift(today, -29);
  if (key === "90d") from = shift(today, -89);
  if (key === "month") from = `${today.slice(0, 8)}01`;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  const label = key === "custom" ? `${fmtDay(from)} – ${fmtDay(to)}` : (RANGES.find((r) => r.key === key)?.label ?? "");
  const compare = key === "today" ? "yesterday" : key === "month" ? "the same days before" : `the ${days} days before`;
  return { key, from, to, days, label, compare };
}

export function fmtDay(day: string, withYear = false) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** Percent change, or null when there's nothing to compare with. */
export function change(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}
