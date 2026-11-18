import Link from "next/link";
import type { ReactNode } from "react";
import { HourHeatmap } from "@/components/admin/charts";
import { fmtValue, pctChange, SERIES, type Unit } from "@/lib/analytics/format";
import { DIMENSIONS, dimValue, METRICS } from "@/lib/analytics/metrics";
import { fmtDate, fmtRange } from "@/lib/analytics/range";
import { points, prevTotal, total, unitOf, type CohortRow, type ReportResult, type Row } from "@/lib/analytics/engine";
import { Donut, LineChart, Sparkline } from "./charts";

export const EMPTY_TEXT = "No data for this date range";

export function Empty({ children = EMPTY_TEXT }: { children?: ReactNode }) {
  return <p className="grid min-h-28 place-content-center px-2 py-6 text-center text-sm text-muted">{children}</p>;
}

/** A dashboard card. The title links to the full report when there is one. */
export function Card({ title, href, children, className = "", actions }: { title: string; href?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card flex min-w-0 flex-col gap-3 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans text-[14px] font-semibold text-cocoa">
          {href ? (
            <Link href={href} className="underline decoration-cocoa/30 decoration-dotted underline-offset-4 hover:decoration-cocoa">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Change against the comparison period. `upIsGood` flips the color for things like refusals. */
export function ChangePill({ cur, prev, upIsGood = true }: { cur: number; prev: number | null | undefined; upIsGood?: boolean }) {
  const d = pctChange(cur, prev);
  if (d === null) return <span className="text-xs text-muted" aria-label="No comparison">—</span>;
  const good = d === 0 ? null : d > 0 === upIsGood;
  return (
    <span className={`chip num px-2 ${good === null ? "bg-cocoa/10 text-cocoa" : good ? "bg-sage/20 text-[#4d5a33]" : "bg-rose/15 text-[#a33a52]"}`}>
      <span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "•"}</span>
      <span className="sr-only">{d > 0 ? "Up" : d < 0 ? "Down" : "No change"}</span>
      {Math.abs(d)}%
    </span>
  );
}

export function KpiCard({ title, value, unit, spark, cur, prev, upIsGood, href }: {
  title: string; value: number; unit: Unit; spark: number[]; cur: number; prev: number | null; upIsGood?: boolean; href?: string;
}) {
  return (
    <section className="card flex items-center justify-between gap-3 p-4">
      <div className="grid min-w-0 gap-1">
        <h3 className="font-sans text-[14px] font-semibold text-cocoa">
          {href ? <Link href={href} className="underline decoration-cocoa/30 decoration-dotted underline-offset-4 hover:decoration-cocoa">{title}</Link> : title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[20px] leading-none font-medium text-cocoa">{fmtValue(value, unit)}</span>
          <ChangePill cur={cur} prev={prev} upIsGood={upIsGood} />
        </div>
      </div>
      <Sparkline values={spark} />
    </section>
  );
}

/** Ranked list with one thin bar per row (one color: the bar length is the value). The comparison period sits under it. */
export function HBarList({ rows, unit, empty }: { rows: { label: string; value: number; prev?: number | null; sub?: string }[]; unit: Unit; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.flatMap((r) => [r.value, r.prev ?? 0]));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid gap-1" title={`${r.label}: ${fmtValue(r.value, unit)}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="num shrink-0 font-medium">
              {fmtValue(r.value, unit)}
              {r.sub && <span className="ms-2 text-xs font-normal text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-cream/70" aria-hidden="true">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: SERIES.main }} />
          </div>
          {r.prev != null && (
            <div className="h-1 rounded-full" aria-hidden="true">
              <div className="h-1 rounded-full" style={{ width: `${Math.max(1, (r.prev / max) * 100)}%`, background: SERIES.compare }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Plain striped list, like a table with two columns. */
export function RankList({ rows, unit }: { rows: { label: string; value: number; prev?: number | null }[]; unit: Unit }) {
  if (!rows.length) return <Empty />;
  return (
    <ul className="grid text-[13px]">
      {rows.map((r, i) => (
        <li key={r.label} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${i % 2 ? "" : "bg-cream/60"}`}>
          <span className="min-w-0 truncate" title={r.label}>{r.label}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="num font-medium">{fmtValue(r.value, unit)}</span>
            {r.prev !== undefined && <ChangePill cur={r.value} prev={r.prev} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sessions → added to cart → reached checkout → completed, with a stepped shape under the numbers. */
export function Funnel({ res }: { res: ReportResult }) {
  const steps = [
    { key: "sessions", label: "Sessions" },
    { key: "cart_sessions", label: "Added to cart" },
    { key: "checkout_sessions", label: "Reached checkout" },
    { key: "completed_sessions", label: "Completed checkout" },
  ];
  const base = total(res, "sessions");
  const prevBase = prevTotal(res, "sessions");
  if (!base) return <Empty />;
  const shades = [1, 0.74, 0.52, 0.36];
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const v = total(res, s.key);
          const pv = prevTotal(res, s.key);
          const rate = (v / base) * 100;
          const prate = pv !== null && prevBase ? (pv / prevBase) * 100 : null;
          return (
            <div key={s.key} className="grid min-w-0 content-start gap-0.5">
              <span className="truncate text-xs text-muted" title={s.label}>{s.label}</span>
              <span className="num text-[15px] font-medium">{i === 0 ? "100%" : `${Math.round(rate * 100) / 100}%`}</span>
              <span className="num text-xs text-muted">{v}</span>
              {i > 0 && <span><ChangePill cur={rate} prev={prate} /></span>}
            </div>
          );
        })}
      </div>
      <svg viewBox="0 0 400 110" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Funnel from sessions to completed checkout">
        {steps.map((s, i) => {
          const v = total(res, s.key);
          const h = Math.max(6, (v / base) * 108);
          return <rect key={s.key} x={i * 100 + 2} y={110 - h} width="96" height={h} rx="4" fill={SERIES.main} opacity={shades[i]} />;
        })}
      </svg>
    </div>
  );
}

/** Customers who first ordered in a month and ordered again in month 0, 1, 2 ... The darker the cell, the higher the share. */
export function CohortTable({ rows }: { rows: CohortRow[] }) {
  const active = rows.filter((r) => r.size > 0);
  if (!active.length) return <Empty>No customers yet</Empty>;
  const all: { n: number; size: number }[] = Array.from({ length: 12 }, () => ({ n: 0, size: 0 }));
  for (const r of active) r.counts.forEach((c, m) => { all[m].n += c; all[m].size += r.size; });
  const pct = (n: number, size: number) => (size ? (n / size) * 100 : 0);
  const peak = Math.max(1, ...active.flatMap((r) => r.counts.map((c) => pct(c, r.size))));
  const shade = (p: number) => (p === 0 ? "transparent" : `color-mix(in srgb, ${SERIES.main} ${Math.round(14 + (p / peak) * 56)}%, #fff)`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[12px]">
        <thead>
          <tr className="text-muted">
            <th scope="col" className="px-2 py-1 text-start font-medium">Cohort</th>
            <th scope="col" className="px-2 py-1 text-end font-medium">Customers</th>
            {Array.from({ length: 12 }, (_, m) => <th key={m} scope="col" className="px-1 py-1 text-center font-medium whitespace-nowrap">Month {m}</th>)}
          </tr>
        </thead>
        <tbody className="num">
          <tr className="font-semibold">
            <th scope="row" className="px-2 py-1 text-start">All cohorts</th>
            <td className="px-2 py-1 text-end">{active.reduce((t, r) => t + r.size, 0)}</td>
            {all.map((a, m) => <td key={m} className="px-1 py-1 text-center">{a.size ? `${Math.round(pct(a.n, a.size) * 10) / 10}%` : ""}</td>)}
          </tr>
          {active.map((r) => (
            <tr key={r.cohort}>
              <th scope="row" className="px-2 py-1 text-start font-normal whitespace-nowrap">{new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${r.cohort}T00:00:00Z`))}</th>
              <td className="px-2 py-1 text-end">{r.size}</td>
              {Array.from({ length: 12 }, (_, m) => {
                const c = r.counts[m];
                if (c === undefined) return <td key={m} />;
                const p = pct(c, r.size);
                return (
                  <td key={m} className="rounded-md px-1 py-1 text-center" style={{ background: shade(p), color: p / peak > 0.55 ? "#fff" : "var(--cocoa)" }} title={`${c} of ${r.size} customers`}>
                    {Math.round(p * 10) / 10}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellLabel = (dim: string, v: string | number | null) => (dim === "day" || dim === "week" || dim === "month" ? fmtDate(String(v), true) : dimValue(dim, v));

/** Every metric of the report, with a totals row (unless the report is a list of orders). */
export function DataTable({ res, withTotals = true }: { res: ReportResult; withTotals?: boolean }) {
  const dims = res.timeDim ? [res.timeDim, ...res.def.dims.slice(1)] : res.def.dims;
  const metrics = res.def.metrics;
  const M = METRICS[res.def.schema];
  if (!res.cur.rows.length) return <Empty />;
  const rows = res.timeDim && dims.length === 1 ? [...res.cur.rows].reverse() : res.cur.rows;
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-line">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead className="sticky top-0 bg-cream text-left">
          <tr>
            {dims.map((d) => <th key={d} scope="col" className="px-3 py-2 font-semibold">{DIMENSIONS[d] ?? d}</th>)}
            {metrics.map((m) => <th key={m} scope="col" className="px-3 py-2 text-end font-semibold whitespace-nowrap">{M[m]?.label ?? m}</th>)}
          </tr>
        </thead>
        <tbody className="num">
          {withTotals && Object.keys(res.cur.totals).length > 0 && (
            <tr className="border-b border-line bg-cream/50 font-semibold">
              <th scope="row" colSpan={Math.max(1, dims.length)} className="px-3 py-2 text-start">Total</th>
              {metrics.map((m) => <td key={m} className="px-3 py-2 text-end">{fmtValue(Number(res.cur.totals[m]), M[m]?.unit ?? "count")}</td>)}
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0 odd:bg-white even:bg-page/60">
              {dims.map((d) => <td key={d} className="px-3 py-2 whitespace-nowrap">{cellLabel(d, r[d])}</td>)}
              {metrics.map((m) => <td key={m} className="px-3 py-2 text-end">{fmtValue(Number(r[m]), M[m]?.unit ?? "count")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Gross sales → total sales as a short list, each row with its change. */
export function BreakdownList({ res }: { res: ReportResult }) {
  const M = METRICS[res.def.schema];
  return (
    <ul className="grid text-[14px]">
      {res.def.metrics.map((m, i) => {
        const v = total(res, m);
        const strong = m === "net_sales" || m === "total_sales";
        return (
          <li key={m} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${i % 2 ? "" : "bg-cream/60"}`}>
            <span className={strong ? "font-semibold" : ""}>{M[m].label}</span>
            <span className="flex items-center gap-3">
              <span className={`num ${strong ? "font-semibold" : ""}`}>{m === "discounts" || m === "sales_reversals" ? "-" : ""}{fmtValue(v, M[m].unit)}</span>
              <ChangePill cur={v} prev={prevTotal(res, m)} upIsGood={M[m].upIsGood} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Rows as {label, value, prev} for bars, donuts and lists. Label comes from the first dimension. */
export function labelled(res: ReportResult, metric: string) {
  const dim = res.def.dims[0];
  const prevByLabel = new Map((res.prev?.rows ?? []).map((r: Row) => [String(r[dim]), Number(r[metric] ?? 0)]));
  return res.cur.rows.map((r) => ({
    label: dimValue(dim, r[dim]),
    value: Number(r[metric] ?? 0),
    ...(res.prev ? { prev: prevByLabel.get(String(r[dim])) ?? 0 } : {}),
  }));
}

/** The chart a report calls for. Cohorts load separately, so they are passed in. */
export function ReportChart({ res, metric, cohorts, big = false }: { res: ReportResult; metric?: string; cohorts?: CohortRow[]; big?: boolean }) {
  const def = res.def;
  const m = metric ?? def.primary ?? def.metrics[0];
  const unit = unitOf(res, m);
  const name = `${def.title}: ${METRICS[def.schema][m]?.label ?? m}`;
  switch (def.chart) {
    case "line":
      return (
        <LineChart
          points={points(res, m)} unit={unit} name={name} height={big ? 300 : 230}
          rangeLabel={fmtRange(res.range.from, res.range.to)}
          prevLabel={res.range.prevFrom && res.range.prevTo ? fmtRange(res.range.prevFrom, res.range.prevTo) : undefined}
        />
      );
    case "bar": {
      const rows = labelled(res, m).slice(0, big ? 30 : 6);
      return rows.length ? <HBarList rows={rows} unit={unit} /> : <Empty />;
    }
    case "list": {
      const rows = labelled(res, m).slice(0, big ? 30 : 6);
      return <RankList rows={rows} unit={unit} />;
    }
    case "donut":
      return <Donut slices={labelled(res, m)} unit={unit} centerLabel={METRICS[def.schema][m]?.label ?? m} />;
    case "heatmap": {
      const data = res.cur.rows.map((r) => ({ dow: Number(r.day_of_week), hour: Number(r.hour_of_day), orders: Number(r[m]) }));
      return data.length ? <HourHeatmap data={data} /> : <Empty />;
    }
    case "funnel":
      return <Funnel res={res} />;
    case "breakdown":
      return <BreakdownList res={res} />;
    case "cohort":
      return <CohortTable rows={cohorts ?? []} />;
    case "table":
      return <DataTable res={res} withTotals />;
  }
}
