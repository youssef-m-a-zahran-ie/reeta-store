import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { costComplete, loadCohorts, prevTotal, runReport, total } from "@/lib/analytics/engine";
import { fmtValue } from "@/lib/analytics/format";
import { METRICS } from "@/lib/analytics/metrics";
import { reportBySlug } from "@/lib/analytics/registry";
import { resolveRange } from "@/lib/analytics/range";
import { AnalyticsFilters } from "@/components/analytics/filters";
import { Card, ChangePill, DataTable, ReportChart } from "@/components/analytics/blocks";

export async function generateMetadata({ params }: PageProps<"/admin/analytics/reports/[slug]">): Promise<Metadata> {
  const def = reportBySlug((await params).slug);
  return { title: def?.title ?? "Report" };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/admin/analytics/reports/[slug]">) {
  const def = reportBySlug((await params).slug);
  if (!def) notFound();
  const sp = await searchParams;
  const range = resolveRange(sp, "30d");
  const { supabase } = await requireAdmin();

  const M = METRICS[def.schema];
  const asked = typeof sp.m === "string" ? sp.m : "";
  const metric = def.metrics.includes(asked) ? asked : (def.primary ?? def.metrics[0]);
  const [res, cohorts, complete] = await Promise.all([
    runReport(supabase, def, range),
    def.chart === "cohort" ? loadCohorts(supabase, 12) : Promise.resolve([]),
    def.needsCost ? costComplete(supabase, range) : Promise.resolve(true),
  ]);

  const picks = ["line", "bar", "donut", "list"].includes(def.chart) && def.metrics.length > 1;
  const base = `from=${range.from}&to=${range.to}&cmp=${range.cmp}`;
  const showTable = !["cohort", "breakdown", "table", "funnel", "heatmap"].includes(def.chart);
  const headline = ["line", "bar", "donut", "list"].includes(def.chart);
  const unit = M[metric]?.unit ?? "count";

  return (
    <>
      <PageHeader
        eyebrow={def.category}
        title={def.title}
        description={def.note}
        actions={
          <>
            <Link href="/admin/analytics/reports" className="btn btn-secondary">All reports</Link>
            <a className="btn btn-secondary" href={`/admin/analytics/reports/${def.slug}/export?${base}`} download>Download CSV</a>
          </>
        }
      />
      <div className="mb-4"><AnalyticsFilters from={range.from} to={range.to} cmp={range.cmp} prevFrom={range.prevFrom} prevTo={range.prevTo} /></div>

      {!complete && (
        <p className="mb-4 rounded-xl bg-honey/25 px-4 py-2.5 text-sm" role="note">
          Some items sold in this period have no cost set, so profit looks higher than it is. Add costs in <Link href="/admin/menu" className="underline underline-offset-2">Menu</Link>.
        </p>
      )}

      <div className="grid gap-4">
        <Card title={picks ? (M[metric]?.label ?? metric) : def.title}>
          {picks && (
            <nav className="flex flex-wrap gap-1.5" aria-label="Number to chart">
              {def.metrics.map((m) => (
                <Link key={m} href={`?${base}&m=${m}`} aria-current={m === metric ? "true" : undefined} className="rounded-full px-3 py-1 text-[13px] font-medium text-plum hover:bg-blush aria-[current=true]:bg-plum aria-[current=true]:text-blush">
                  {M[m]?.label ?? m}
                </Link>
              ))}
            </nav>
          )}
          {headline && Object.keys(res.cur.totals).length > 0 && def.chart !== "donut" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[26px] leading-none font-medium">{fmtValue(total(res, metric), unit)}</span>
              <ChangePill cur={total(res, metric)} prev={prevTotal(res, metric)} upIsGood={M[metric]?.upIsGood} />
            </div>
          )}
          <ReportChart res={res} metric={metric} cohorts={cohorts} big />
        </Card>
        {showTable && (
          <Card title="Table"><DataTable res={res} /></Card>
        )}
      </div>
    </>
  );
}
