import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { prevTotal, total, type CohortRow, type ReportResult } from "@/lib/analytics/engine";
import { fmtValue } from "@/lib/analytics/format";
import { buildInsights } from "@/lib/analytics/insights";
import { reportBySlug } from "@/lib/analytics/registry";
import { cairoToday, fmtRange, type Range } from "@/lib/analytics/range";
import { AnalyticsFilters } from "./filters";
import { InsightPanel } from "./insight-panel";
import { Card, ChangePill, KpiCard, ReportChart, labelled } from "./blocks";

const rep = (slug: string) => {
  const d = reportBySlug(slug);
  if (!d) throw new Error(`Unknown report ${slug}`);
  return d;
};

export type DashboardData = {
  sales: ReportResult; returning: ReportResult; aov: ReportResult; channels: ReportResult; products: ReportResult;
  sessions: ReportResult; conversion: ReportResult; funnel: ReportResult; devices: ReportResult; locations: ReportResult;
  sources: ReportResult; landing: ReportResult; payments: ReportResult; distance: ReportResult; weekly: ReportResult;
  cohorts: CohortRow[]; delivered: { spark: number[]; sum: number }; deliveredPrev: { spark: number[]; sum: number } | null;
};

export function Dashboard({ range, d }: { range: Range; d: DashboardData }) {
  const { sales, returning, aov, channels, products, sessions, conversion, funnel, devices, locations, sources, landing, payments, distance, weekly, cohorts } = d;
  const del = d.delivered;
  const delPrev = d.deliveredPrev;
  const spark = (res: ReportResult, m: string) => res.cur.rows.map((r) => Number(r[m] ?? 0));
  const chCh = labelled(channels, "total_sales").sort((a, b) => b.value - a.value);
  const chTotal = chCh.reduce((t, c) => t + c.value, 0);
  const prod = labelled(products, "net_sales")[0];
  const insights = buildInsights({
    today: cairoToday(),
    sales: { cur: total(sales, "total_sales"), prev: prevTotal(sales, "total_sales"), spark: spark(sales, "total_sales") },
    orders: { cur: total(sales, "orders"), prev: prevTotal(sales, "orders"), spark: spark(sales, "orders") },
    from: range.from, to: range.to,
    topChannel: chCh[0] ? { label: chCh[0].label, value: chCh[0].value, share: chTotal ? (chCh[0].value / chTotal) * 100 : 0 } : null,
    topProduct: prod ? { label: prod.label, value: prod.value } : null,
    sessions: { total: total(funnel, "sessions"), cart: total(funnel, "cart_sessions"), checkout: total(funnel, "checkout_sessions"), completed: total(funnel, "completed_sessions") },
  });

  const href = (slug: string, from: string, to: string, cmp: string) => `/admin/analytics/reports/${slug}?from=${from}&to=${to}&cmp=${cmp}`;
  const q = (slug: string) => href(slug, range.from, range.to, range.cmp);
  const refreshed = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date());
  const noVisits = total(sessions, "sessions") === 0;

  return (
    <>
      <PageHeader
        eyebrow="Grow"
        title="Analytics"
        description={`Refreshed today at ${refreshed}. Cancelled and refused orders don't count as sales.`}
        actions={
          <>
            <Link href="/admin/analytics/live" className="btn btn-secondary">Live view</Link>
            <Link href="/admin/analytics/reports" className="btn btn-primary">All reports</Link>
          </>
        }
      />
      <div className="mb-4">
        <AnalyticsFilters from={range.from} to={range.to} cmp={range.cmp} prevFrom={range.prevFrom} prevTo={range.prevTo} />
      </div>

      <div className="grid gap-4">
        <InsightPanel insights={insights} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Gross sales" value={total(sales, "gross_sales")} unit="money" spark={spark(sales, "gross_sales")} cur={total(sales, "gross_sales")} prev={prevTotal(sales, "gross_sales")} href={q("total-sales-over-time")} />
          <KpiCard title="Returning customer rate" value={total(returning, "returning_customer_rate")} unit="percent" spark={spark(returning, "returning_customer_rate")} cur={total(returning, "returning_customer_rate")} prev={prevTotal(returning, "returning_customer_rate")} href={q("returning-customer-rate-over-time")} />
          <KpiCard title="Orders delivered" value={del.sum} unit="count" spark={del.spark} cur={del.sum} prev={delPrev?.sum ?? null} />
          <KpiCard title="Orders" value={total(sales, "orders")} unit="count" spark={spark(sales, "orders")} cur={total(sales, "orders")} prev={prevTotal(sales, "orders")} href={q("orders-over-time")} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Total sales over time" href={q("total-sales-over-time")} className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[24px] leading-none font-medium">{fmtValue(total(sales, "total_sales"), "money")}</span>
              <ChangePill cur={total(sales, "total_sales")} prev={prevTotal(sales, "total_sales")} />
            </div>
            <ReportChart res={sales} />
          </Card>
          <Card title="Total sales breakdown" href={q("total-sales-breakdown")}>
            <ReportChart res={{ ...sales, def: rep("total-sales-breakdown") }} />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Total sales by marketing channel" href={q("total-sales-by-marketing-channel")}><ReportChart res={channels} /></Card>
          <Card title="Average order value over time" href={q("average-order-value-over-time")}>
            <div className="num text-[22px] leading-none font-medium">{fmtValue(total(aov, "average_order_value"), "money")}</div>
            <ReportChart res={aov} />
          </Card>
          <Card title="Total sales by product" href={q("total-sales-by-product")}><ReportChart res={products} metric="net_sales" /></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Sessions over time" href={q("sessions-over-time")}>
            <div className="flex items-center gap-2"><span className="num text-[22px] leading-none font-medium">{total(sessions, "sessions")}</span><ChangePill cur={total(sessions, "sessions")} prev={prevTotal(sessions, "sessions")} /></div>
            {noVisits ? <p className="text-sm text-muted">Visits are counted from the day tracking was switched on. Earlier days have no visit data.</p> : <ReportChart res={sessions} />}
          </Card>
          <Card title="Conversion rate over time" href={q("conversion-rate-over-time")}>
            <div className="flex items-center gap-2"><span className="num text-[22px] leading-none font-medium">{fmtValue(total(conversion, "conversion_rate"), "percent")}</span><ChangePill cur={total(conversion, "conversion_rate")} prev={prevTotal(conversion, "conversion_rate")} /></div>
            {noVisits ? <p className="text-sm text-muted">Needs visit data.</p> : <ReportChart res={conversion} />}
          </Card>
          <Card title="Conversion rate breakdown" href={q("conversion-rate-breakdown")}><ReportChart res={funnel} /></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Sessions by device type" href={q("sessions-by-device-type")}><ReportChart res={devices} /></Card>
          <Card title="Sessions by location" href={q("sessions-by-location")}><ReportChart res={locations} /></Card>
          <Card title="Total sales by source" href={q("total-sales-by-source")}><ReportChart res={sources} /></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Customer cohort analysis" href={q("customer-cohort-analysis")} className="lg:col-span-2"><ReportChart res={{ ...sales, def: rep("customer-cohort-analysis") }} cohorts={cohorts} /></Card>
          <Card title="Sessions by landing page" href={q("sessions-by-landing-page")}><ReportChart res={landing} /></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Sales by payment method" href={q("sales-by-payment-method")}><ReportChart res={payments} /></Card>
          <Card title="Sales by distance from the store" href={q("sales-by-distance")}><ReportChart res={distance} /></Card>
          <Card title="Weekly sales patterns" href={q("weekly-sales-patterns")}><ReportChart res={weekly} /></Card>
        </div>
      </div>
      <p className="mt-6 text-xs text-muted">
        {fmtRange(range.from, range.to)} · times in Cairo · compared with {range.prevFrom && range.prevTo ? fmtRange(range.prevFrom, range.prevTo) : "nothing"}
        {" · "}
        Ad spend and return on ads are in <Link href="/admin/reports" className="underline underline-offset-2">Reports</Link>.
      </p>
    </>
  );
}
