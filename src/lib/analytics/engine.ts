import "server-only";
import type { getAdmin } from "@/lib/admin/guard";
import { daysBetween, fmtDate, grainFor, shiftDay, type Grain, type Range } from "./range";
import { METRICS } from "./metrics";
import type { ReportDef } from "./registry";

type Supa = NonNullable<Awaited<ReturnType<typeof getAdmin>>>["supabase"];
export type Row = Record<string, string | number | null>;
export type QueryOut = { rows: Row[]; totals: Row };
export type ReportResult = { def: ReportDef; range: Range; grain: Grain; timeDim: Grain | null; cur: QueryOut; prev: QueryOut | null };
export type Point = { label: string; prevLabel?: string; value: number; prev?: number | null };

const TIME = new Set(["day", "week", "month"]);
const EMPTY: QueryOut = { rows: [], totals: {} };

export async function query(
  supabase: Supa,
  schema: string,
  metrics: string[],
  dims: string[],
  from: string,
  to: string,
  opts: { order?: string; dir?: "asc" | "desc"; limit?: number } = {},
): Promise<QueryOut> {
  const { data, error } = await supabase.rpc("analytics_query", {
    p_schema: schema,
    p_metrics: metrics,
    p_dims: dims,
    p_from: from,
    p_to: to,
    p_order: opts.order,
    p_dir: opts.dir ?? "desc",
    p_limit: opts.limit ?? 100,
  });
  if (error || !data) {
    console.error("analytics_query failed", schema, metrics, dims, error?.message);
    return EMPTY;
  }
  return data as unknown as QueryOut;
}

const weekStart = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const monthStart = (day: string) => `${day.slice(0, 8)}01`;
const nextMonth = (day: string) => {
  const d = new Date(`${monthStart(day)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

/** Every bucket between two days, so a quiet day shows as zero instead of vanishing. */
export function buckets(from: string, to: string, grain: Grain): string[] {
  const out: string[] = [];
  if (grain === "day") for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  else if (grain === "week") for (let d = weekStart(from); d <= to; d = shiftDay(d, 7)) out.push(d);
  else for (let d = monthStart(from); d <= to; d = nextMonth(d)) out.push(d);
  return out;
}

function fill(out: QueryOut, grain: Grain, from: string, to: string, metrics: string[]): QueryOut {
  const have = new Map(out.rows.map((r) => [String(r[grain]), r]));
  const rows = buckets(from, to, grain).map((d) => have.get(d) ?? { [grain]: d, ...Object.fromEntries(metrics.map((m) => [m, 0])) });
  return { rows, totals: out.totals };
}

export async function runReport(supabase: Supa, def: ReportDef, range: Range, overrides: { metrics?: string[]; limit?: number } = {}): Promise<ReportResult> {
  const grain = grainFor(range.days);
  const timeDim = TIME.has(def.dims[0]) ? grain : null;
  const dims = timeDim ? [grain, ...def.dims.slice(1)] : def.dims;
  const metrics = overrides.metrics ?? def.metrics;
  const order = timeDim ? undefined : def.order ?? def.primary ?? metrics[0];
  const run = async (from: string, to: string) => {
    let out = await query(supabase, def.schema, metrics, dims, from, to, { order, dir: def.dir, limit: overrides.limit ?? def.limit });
    if (timeDim && dims.length === 1) out = fill(out, timeDim, from, to, metrics);
    if (def.schema === "items" && !timeDim) out = { ...out, rows: out.rows.filter((r) => metrics.some((m) => Number(r[m]) !== 0)) };
    return out;
  };
  const [cur, prev] = await Promise.all([run(range.from, range.to), range.prevFrom && range.prevTo ? run(range.prevFrom, range.prevTo) : Promise.resolve(null)]);
  return { def, range, grain, timeDim, cur, prev };
}

/** Points for a line chart: current period with the comparison period lined up bucket by bucket. */
export function points(res: ReportResult, metric: string): Point[] {
  const key = res.timeDim ?? "day";
  return res.cur.rows.map((r, i) => {
    const p = res.prev?.rows[i];
    return {
      label: fmtDate(String(r[key])),
      value: Number(r[metric] ?? 0),
      ...(p ? { prev: Number(p[metric] ?? 0), prevLabel: fmtDate(String(p[key])) } : {}),
    };
  });
}

export const total = (res: ReportResult, metric: string) => Number(res.cur.totals[metric] ?? 0);
export const prevTotal = (res: ReportResult, metric: string) => (res.prev ? Number(res.prev.totals[metric] ?? 0) : null);
export const unitOf = (res: ReportResult, metric: string) => METRICS[res.def.schema][metric]?.unit ?? "count";

export type CohortRow = { cohort: string; size: number; counts: number[] };
export async function loadCohorts(supabase: Supa, months = 12): Promise<CohortRow[]> {
  const { data, error } = await supabase.rpc("analytics_cohorts", { p_months: months });
  if (error || !data) return [];
  return data as unknown as CohortRow[];
}

/** Profit numbers are only complete when every sold item has a cost; the older report says so. */
export async function costComplete(supabase: Supa, range: Range): Promise<boolean> {
  const { data } = await supabase.rpc("admin_report", { p_from: range.from, p_to: range.to });
  const kpi = (data as { kpi?: { profit_complete?: boolean } } | null)?.kpi;
  return kpi?.profit_complete ?? true;
}

export { daysBetween };
