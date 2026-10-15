import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, StatusChip, Swatch } from "@/components/admin/ui";
import { egp, stockLabel } from "@/lib/format";
import { change, resolvePeriod } from "@/lib/admin/period";
import { loadReport } from "@/lib/admin/report";
import { DailySalesChart } from "@/components/admin/charts";
import { BarList, KpiTile, PeriodPicker } from "@/components/admin/stats";

export const metadata: Metadata = { title: "Overview" };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Cairo",
    }).format(new Date()),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage({ searchParams }: PageProps<"/admin">) {
  const period = resolvePeriod(await searchParams, "7d");
  const { supabase } = await requireAdmin();
  const report = await loadReport(supabase, period.from, period.to);
  const [{ data: nuts }, { data: sauces }, { data: sizes }, { data: nutPrices }, { data: saucePrices }, { data: settings }, { data: openOrders }, { data: abandoned }] = await Promise.all([
    supabase.from("custom_bases").select("base_id, image_path, is_active, stock_grams, low_stock_threshold, track_stock, bases(name_en)").order("sort"),
    supabase.from("custom_coatings").select("coating_id, is_active, stock_grams, low_stock_threshold, track_stock, coatings(name_en, color)").order("sort"),
    supabase.from("custom_sizes").select("id, is_active"),
    supabase.from("custom_base_prices").select("base_id, size_id, price, grams"),
    supabase.from("custom_coating_prices").select("coating_id, size_id, price"),
    supabase.from("settings").select("store_lat, fee_per_km, instapay_handle, custom_enabled").eq("id", 1).maybeSingle(),
    supabase
      .from("orders")
      .select("id, number, customer_name, total, status, payment_method, payment_status, created_at")
      .in("status", ["new", "confirmed", "preparing", "out_for_delivery"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("abandoned_checkouts")
      .select("id, name, phone, subtotal, created_at")
      .is("recovered_order_id", null)
      .eq("contacted", false)
      .gte("created_at", daysAgo(3))
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const newOrders = (openOrders ?? []).filter((o) => o.status === "new");
  const awaitingTransfer = (openOrders ?? []).filter((o) => o.payment_method === "instapay" && o.payment_status === "unpaid");

  // Raw ingredients: nuts and sauces, tracked in grams.
  const ingredients = [
    ...(nuts ?? []).map((n) => ({
      key: `b-${n.base_id}`,
      name: n.bases?.name_en ?? "",
      color: null as string | null,
      ...n,
    })),
    ...(sauces ?? []).map((c) => ({
      key: `c-${c.coating_id}`,
      name: c.coatings?.name_en ?? "",
      color: c.coatings?.color ?? null,
      ...c,
    })),
  ]
    .filter((i) => i.is_active)
    .map((i) => ({
      ...i,
      level: (!i.track_stock ? "ok" : i.stock_grams <= 0 ? "out" : i.stock_grams <= i.low_stock_threshold ? "low" : "ok") as "out" | "low" | "ok",
    }));
  const lowStock = ingredients.filter((i) => i.level !== "ok");

  const liveNuts = (nuts ?? []).filter((n) => n.is_active);
  const liveSauces = (sauces ?? []).filter((c) => c.is_active);
  const liveSizes = (sizes ?? []).filter((z) => z.is_active);
  const missingPrices =
    liveNuts.reduce(
      (n, b) =>
        n +
        liveSizes.filter((z) => {
          const r = (nutPrices ?? []).find((x) => x.base_id === b.base_id && x.size_id === z.id);
          return !r || r.price === null || r.grams === null;
        }).length,
      0,
    ) +
    liveSauces.reduce(
      (n, c) =>
        n +
        liveSizes.filter((z) => {
          const r = (saucePrices ?? []).find((x) => x.coating_id === c.coating_id && x.size_id === z.id);
          return !r || r.price === null;
        }).length,
      0,
    );
  const noPhoto = liveNuts.filter((n) => !n.image_path).length;
  const unstocked = ingredients.filter((i) => i.track_stock && i.stock_grams <= 0).length;

  const launch = [
    {
      done: missingPrices === 0 && liveNuts.length > 0,
      title: "Fill in the menu prices",
      detail: missingPrices ? `${missingPrices} price or weight boxes are empty.` : "All menu prices and weights are set.",
      href: "/admin/menu",
    },
    {
      done: liveNuts.length > 0 && noPhoto === 0,
      title: "Upload the plate photos",
      detail: noPhoto ? `${noPhoto} nuts have no plain plate photo yet.` : "Every nut has its plate photo.",
      href: "/admin/menu/photos",
    },
    {
      done: ingredients.length > 0 && unstocked === 0,
      title: "Add your nut and sauce stock",
      detail: unstocked ? `${unstocked} nuts or sauces are at 0 g.` : "Everything on the menu has stock.",
      href: "/admin/inventory",
    },
    {
      done: Boolean(settings?.custom_enabled),
      title: "Turn selling on",
      detail: settings?.custom_enabled ? "The menu is open for orders." : "The menu switch is off.",
      href: "/admin/menu",
    },
    {
      done: Boolean(settings?.store_lat && settings?.fee_per_km && settings?.instapay_handle),
      title: "Delivery and payment settings",
      detail: "Store location, price per km and InstaPay details.",
      href: "/admin/settings",
    },
  ];
  const doneCount = launch.filter((l) => l.done).length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={greeting()}
        description="How the store is doing, and what needs you."
        actions={
          <Link href={`/admin/reports?range=${period.key}${period.key === "custom" ? `&from=${period.from}&to=${period.to}` : ""}`} className="btn btn-secondary">
            Full reports
          </Link>
        }
      />

      <PeriodPicker path="/admin" current={period.key} from={period.from} to={period.to} />
      {report && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Sales" value={egp(report.kpi.sales)} delta={change(report.kpi.sales, report.prev.sales)} compare={period.compare} />
            <KpiTile label="Orders" value={String(report.kpi.orders)} delta={change(report.kpi.orders, report.prev.orders)} compare={period.compare} />
            <KpiTile label="Average order" value={egp(report.kpi.aov)} delta={change(report.kpi.aov, report.prev.aov)} compare={period.compare} />
            <KpiTile
              label="Profit on products"
              value={egp(report.kpi.profit)}
              delta={change(report.kpi.profit, report.prev.profit)}
              compare={period.compare}
              hint={report.kpi.profit_complete ? "Sales minus product cost and discounts" : "Some items have no cost set, so this is too high"}
            />
          </div>
          <div className="mb-5 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Section title="Sales per day" description={`${period.label} · cancelled and refused orders left out`}>
              {report.kpi.all_orders === 0 ? <p className="text-sm text-muted">No orders in this period yet.</p> : <DailySalesChart data={report.daily} />}
            </Section>
            <Section title="Best sellers" description={period.label}>
              <BarList
                empty="Nothing sold in this period yet."
                rows={report.products.slice(0, 6).map((p) => ({
                  label: (
                    <>
                      {p.name}
                      {p.label && <span className="text-muted"> · {p.label}</span>}
                    </>
                  ),
                  value: p.sales,
                  display: egp(p.sales),
                  sub: `×${p.qty}`,
                }))}
              />
            </Section>
          </div>
        </>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Nuts on the menu", value: liveNuts.length },
          { label: "Sauces on the menu", value: liveSauces.length },
          {
            label: "Running low",
            value: lowStock.filter((i) => i.level === "low").length,
          },
          {
            label: "Out of stock",
            value: lowStock.filter((i) => i.level === "out").length,
          },
        ].map((s) => (
          <div key={s.label} className="card grid gap-1 p-4">
            <span className="text-sm text-muted">{s.label}</span>
            <span className="num text-3xl font-medium text-plum">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Section
          title="Get ready to launch"
          description={`${doneCount} of ${launch.length} done.`}
          actions={
            <div className="h-2.5 w-32 overflow-hidden rounded-full bg-cocoa/10" aria-hidden="true">
              <div className="h-full rounded-full bg-sage" style={{ width: `${(doneCount / launch.length) * 100}%` }} />
            </div>
          }
        >
          <ol className="grid gap-2">
            {launch.map((l) => {
              const inner = (
                <>
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${l.done ? "bg-sage text-white" : "border-[1.5px] border-plum/30 text-transparent"}`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="grid gap-0.5">
                    <span className={`font-semibold ${l.done ? "text-muted line-through decoration-1" : "text-plum"}`}>{l.title}</span>
                    <span className="text-sm text-muted">{l.detail}</span>
                  </span>
                </>
              );
              return (
                <li key={l.title}>
                  {l.href && !l.done ? (
                    <Link href={l.href} className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-blush/60">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl p-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>

        <div className="grid gap-5">
          <Section
            title="Needs you now"
            actions={
              <Link href="/admin/orders" className="btn btn-ghost btn-sm">
                Orders
              </Link>
            }
          >
            {!newOrders.length && !awaitingTransfer.length && !(abandoned ?? []).length ? (
              <p className="text-sm text-muted">Nothing waiting. New orders show up here first.</p>
            ) : (
              <div className="grid gap-4">
                {newOrders.length > 0 && (
                  <NeedList title={`${newOrders.length} new order${newOrders.length === 1 ? "" : "s"} to confirm`}>
                    {newOrders.slice(0, 5).map((o) => (
                      <NeedRow key={o.id} href={`/admin/orders/${o.id}`} left={`#${o.number} · ${o.customer_name}`} right={egp(o.total)} />
                    ))}
                  </NeedList>
                )}
                {awaitingTransfer.length > 0 && (
                  <NeedList title="InstaPay transfers to check">
                    {awaitingTransfer.slice(0, 5).map((o) => (
                      <NeedRow key={o.id} href={`/admin/orders/${o.id}`} left={`#${o.number} · ${o.customer_name}`} right={egp(o.total)} />
                    ))}
                  </NeedList>
                )}
                {(abandoned ?? []).length > 0 && (
                  <NeedList title="Started checkout but didn't order">
                    {(abandoned ?? []).slice(0, 5).map((a) => (
                      <NeedRow key={a.id} href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} external left={`${a.name || "Someone"} · ${a.phone}`} right={a.subtotal ? egp(a.subtotal) : ""} />
                    ))}
                  </NeedList>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Stock to watch"
            actions={
              <Link href="/admin/inventory" className="btn btn-ghost btn-sm">
                Inventory
              </Link>
            }
          >
            {!lowStock.length ? (
              <p className="text-sm text-muted">No nut or sauce is running low.</p>
            ) : (
              <ul className="grid gap-2">
                {lowStock.map((i) => (
                  <li key={i.key}>
                    <Link href="/admin/inventory#menu" className="flex items-center gap-3 rounded-xl p-2 hover:bg-blush/60">
                      <Swatch color={i.color} size={16} />
                      <span className="flex-1 font-medium text-plum">{i.name}</span>
                      <span className="num text-sm">{stockLabel("grams", i.stock_grams)}</span>
                      <StatusChip status={i.level} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function NeedList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-semibold text-plum">{title}</p>
      <ul className="grid gap-1">{children}</ul>
    </div>
  );
}

function NeedRow({ href, left, right, external }: { href: string; left: string; right: string; external?: boolean }) {
  const cls = "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-blush/60";
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          <span className="truncate">{left}</span>
          <span className="num shrink-0 font-semibold">{right}</span>
        </a>
      ) : (
        <Link href={href} className={cls}>
          <span className="truncate">{left}</span>
          <span className="num shrink-0 font-semibold">{right}</span>
        </Link>
      )}
    </li>
  );
}

/** ISO timestamp for n days ago (server-side, per request). */
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
