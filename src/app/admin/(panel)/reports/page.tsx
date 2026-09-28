import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section } from "@/components/admin/ui";
import { DailySalesChart, HourHeatmap } from "@/components/admin/charts";
import { BarList, KpiTile, PeriodPicker } from "@/components/admin/stats";
import { change, resolvePeriod } from "@/lib/admin/period";
import { loadReport, PLATFORM_LABEL, sourceLabel } from "@/lib/admin/report";
import { egp, grams } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
/** Plain number for table cells; the column header says EGP. */
const n = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const period = resolvePeriod(await searchParams, "30d");
  const { supabase } = await requireAdmin();
  const r = await loadReport(supabase, period.from, period.to);
  const qs = `from=${period.from}&to=${period.to}`;

  if (!r)
    return (
      <>
        <PageHeader eyebrow="Grow" title="Reports" />
        <p className="text-muted">Couldn&apos;t load the numbers. Refresh the page.</p>
      </>
    );

  const k = r.kpi;
  const spend = r.spend.reduce((s, x) => s + x.amount, 0);
  const adSales = r.spend.reduce((s, x) => s + x.sales, 0);
  const roas = spend ? k.sales / spend : null;
  const prevRoas = r.spend_prev ? r.prev.sales / r.spend_prev : null;

  return (
    <>
      <PageHeader
        eyebrow="Grow"
        title="Reports"
        description="Where sales come from, what sells, and when. Cancelled and refused orders don't count as sales."
        actions={
          <>
            <a href={`/admin/reports/export?kind=orders&${qs}`} className="btn btn-secondary" download>
              Orders (Excel)
            </a>
            <a href={`/admin/reports/export?kind=products&${qs}`} className="btn btn-secondary" download>
              Products (Excel)
            </a>
          </>
        }
      />
      <PeriodPicker path="/admin/reports" current={period.key} from={period.from} to={period.to} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Sales" value={egp(k.sales)} delta={change(k.sales, r.prev.sales)} compare={period.compare} />
        <KpiTile label="Orders" value={String(k.orders)} delta={change(k.orders, r.prev.orders)} compare={period.compare} />
        <KpiTile label="Average order" value={egp(k.aov)} delta={change(k.aov, r.prev.aov)} compare={period.compare} />
        <KpiTile
          label="Profit on products"
          value={egp(k.profit)}
          delta={change(k.profit, r.prev.profit)}
          compare={period.compare}
          hint={k.profit_complete ? undefined : "Some items have no cost set"}
        />
        <KpiTile
          label="Ad spend"
          value={egp(Math.round(spend))}
          delta={change(spend, r.spend_prev)}
          compare={period.compare}
          upIsGood={false}
          hint={
            <Link href="/admin/ad-spend" className="underline underline-offset-2">
              Add spend
            </Link>
          }
        />
        <KpiTile
          label="Return on ad spend"
          value={roas === null ? "–" : `${roas.toFixed(1)}×`}
          delta={roas !== null && prevRoas !== null ? change(roas, prevRoas) : undefined}
          compare={period.compare}
          hint="All sales ÷ ad spend"
        />
        <KpiTile
          label="Repeat orders"
          value={pct(k.returning, k.orders)}
          hint={`${k.returning} of ${k.orders} orders came from people who ordered before`}
        />
        <KpiTile
          label="Refused at the door"
          value={pct(k.refused, k.all_orders)}
          delta={change(k.refused, r.prev.refused)}
          compare={period.compare}
          upIsGood={false}
          hint={`${k.refused} refused · ${k.cancelled} cancelled`}
        />
      </div>

      <div className="grid gap-5">
        <Section title="Sales per day" description={period.label}>
          {k.all_orders === 0 ? <p className="text-sm text-muted">No orders in this period yet.</p> : <DailySalesChart data={r.daily} />}
        </Section>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Section title="Where sales come from" description="From the ad link (utm_source), or how the team added the order.">
            <BarList
              empty="No sales in this period yet."
              rows={r.sources.map((s) => ({
                label: sourceLabel(s.source),
                value: s.sales,
                display: egp(s.sales),
                sub: `${s.orders} · ${pct(s.sales, k.sales)}`,
              }))}
            />
          </Section>

          <Section
            title="Ads"
            description="Spend against sales from each platform's links."
            actions={
              <Link href="/admin/ad-spend" className="btn btn-ghost btn-sm">
                Ad spend
              </Link>
            }
          >
            {!r.spend.length ? (
              <p className="text-sm text-muted">No ad spend entered for this period. Add it on the Ad spend page to see return per platform.</p>
            ) : (
              <Table
                head={["Platform", "Spend (EGP)", "Orders", "Sales (EGP)", "Return", "Cost per order"]}
                rows={r.spend.map((x) => [
                  PLATFORM_LABEL[x.platform] ?? x.platform,
                  n(x.amount),
                  String(x.orders),
                  n(x.sales),
                  x.amount ? `${(x.sales / x.amount).toFixed(1)}×` : "–",
                  x.orders ? n(x.amount / x.orders) : "–",
                ])}
                foot={
                  <p className="mt-2 text-xs text-muted">
                    Ad links bring in {egp(adSales)} of {egp(k.sales)}. Orders without a tagged link count as Direct.
                  </p>
                }
              />
            )}
          </Section>
        </div>

        <Section title="Products" description={`${period.label} · bundles are counted as one line`}>
          {!r.products.length ? (
            <p className="text-sm text-muted">Nothing sold in this period yet.</p>
          ) : (
            <Table
              head={["Product", "Sold", "Weight", "Sales (EGP)", "Profit (EGP)", "Margin"]}
              rows={r.products.map((p) => [
                <>
                  {p.name}
                  {p.label && <span className="text-muted"> · {p.label}</span>}
                  {p.bundle && <span className="chip ms-2 bg-plum/10 text-plum">Box</span>}
                </>,
                `×${p.qty}`,
                p.grams ? grams(p.grams) : "–",
                n(p.sales),
                n(p.profit),
                pct(p.profit, p.sales),
              ])}
            />
          )}
        </Section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section title="Discount codes">
            {!r.discounts.length ? (
              <p className="text-sm text-muted">No codes used in this period.</p>
            ) : (
              <Table
                head={["Code", "Orders", "Sales (EGP)", "Given (EGP)"]}
                rows={r.discounts.map((d) => [<span key="c" className="font-semibold">{d.code}</span>, String(d.orders), n(d.sales), n(d.given)])}
              />
            )}
          </Section>
          <Section title="Delivery distance">
            {!r.distances.length ? (
              <p className="text-sm text-muted">No deliveries in this period.</p>
            ) : (
              <Table head={["Distance", "Orders", "Avg fee (EGP)", "Sales (EGP)"]} rows={r.distances.map((d) => [d.bucket, String(d.orders), n(d.avg_fee), n(d.sales)])} />
            )}
            <p className="mt-3 text-xs text-muted">Delivery fees collected: {egp(k.delivery)}</p>
          </Section>
        </div>

        <Section title="When people order" description="Cairo time. Use it to time posts and ads.">
          <HourHeatmap data={r.hours} />
        </Section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section title="Payment">
            <BarList
              empty="No orders yet."
              rows={r.payments.map((p) => ({
                label: p.method === "cod" ? "Cash on delivery" : "InstaPay",
                value: p.orders,
                display: `${p.orders} orders`,
                sub: pct(p.orders, k.orders),
              }))}
            />
          </Section>
          <Section title="Unfinished checkouts" description="People who typed their phone at checkout but didn't order.">
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Started", String(r.abandoned.total)],
                ["Ordered later", String(r.abandoned.recovered)],
                ["Left in carts", egp(r.abandoned.value)],
              ].map(([a, b]) => (
                <div key={a} className="rounded-2xl bg-page px-2 py-3">
                  <dt className="text-xs text-muted">{a}</dt>
                  <dd className="font-display text-lg font-semibold text-plum">{b}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}

function Table({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-sm">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pe-3 align-bottom font-display text-sm font-semibold text-plum ${i ? "text-end" : "text-start"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-line">
              {row.map((c, ci) => (
                <td key={ci} className={`py-2.5 pe-3 ${ci ? "num text-end whitespace-nowrap" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {foot}
    </div>
  );
}
