import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { buckets, loadCohorts, runReport } from "@/lib/analytics/engine";
import { reportBySlug } from "@/lib/analytics/registry";
import { resolveRange } from "@/lib/analytics/range";
import { Dashboard } from "@/components/analytics/dashboard";

export const metadata: Metadata = { title: "Analytics" };

const rep = (slug: string) => {
  const d = reportBySlug(slug);
  if (!d) throw new Error(`Unknown report ${slug}`);
  return d;
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const range = resolveRange(await searchParams, "30d");
  const { supabase } = await requireAdmin();
  const run = (slug: string, limit?: number) => runReport(supabase, rep(slug), range, { limit });

  // Orders delivered per day, counted on the day they were delivered.
  const deliveredIn = async (from: string, to: string) => {
    const { data } = await supabase.rpc("analytics_delivered", { p_from: from, p_to: to });
    const rows = Array.isArray(data) ? (data as { d: string; n: number }[]) : [];
    const byDay = new Map(rows.map((r) => [String(r.d), Number(r.n)]));
    const spark = buckets(from, to, "day").map((d) => byDay.get(d) ?? 0);
    return { spark, sum: spark.reduce((a, b) => a + b, 0) };
  };

  const [sales, returning, aov, channels, products, sessions, conversion, funnel, devices, locations, sources, landing, payments, distance, weekly, cohorts, delivered, deliveredPrev] = await Promise.all([
    run("total-sales-over-time"),
    run("returning-customer-rate-over-time"),
    run("average-order-value-over-time"),
    run("total-sales-by-marketing-channel"),
    run("total-sales-by-product", 5),
    run("sessions-over-time"),
    run("conversion-rate-over-time"),
    run("conversion-rate-breakdown"),
    run("sessions-by-device-type"),
    run("sessions-by-location", 5),
    run("total-sales-by-source", 5),
    run("sessions-by-landing-page", 6),
    run("sales-by-payment-method"),
    run("sales-by-distance"),
    run("weekly-sales-patterns"),
    loadCohorts(supabase, 12),
    deliveredIn(range.from, range.to),
    range.prevFrom && range.prevTo ? deliveredIn(range.prevFrom, range.prevTo) : Promise.resolve(null),
  ]);


  return (
    <Dashboard
      range={range}
      d={{ sales, returning, aov, channels, products, sessions, conversion, funnel, devices, locations, sources, landing, payments, distance, weekly, cohorts, delivered, deliveredPrev }}
    />
  );
}
