import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section, StatusChip, Swatch } from "@/components/admin/ui";
import { dateTime, stockLabel } from "@/lib/format";
import { StockForm } from "./stock-form";

export const metadata: Metadata = { title: "Inventory" };

const REASON: Record<string, string> = {
  order: "Order",
  cancelled: "Order cancelled",
  refused: "Refused at door",
  batch: "New batch",
  adjustment: "Correction",
  initial: "Starting stock",
};

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const sp = await searchParams;
  const focus = typeof sp.product === "string" ? sp.product : "";
  const { supabase } = await requireAdmin();

  let movesQuery = supabase
    .from("stock_movements")
    .select("id, delta, reason, note, created_at, product_id, products(name_en, stock_unit), variants(option_values(label_en), label_en), orders(number)")
    .order("created_at", { ascending: false })
    .limit(40);
  if (focus) movesQuery = movesQuery.eq("product_id", focus);

  const [{ data: products }, { data: moves }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name_en, name_ar, status, color, stock_unit, stock_grams, low_stock_threshold, coatings(color), variants(id, stock_qty, is_active, label_en, sort, option_values(label_en, sort))")
      .neq("status", "archived")
      .order("sort"),
    movesQuery,
  ]);

  const rows = (products ?? []).map((p) => {
    const vars = (p.variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => (a.option_values?.sort ?? a.sort) - (b.option_values?.sort ?? b.sort));
    const stock = p.stock_unit === "grams" ? p.stock_grams : vars.reduce((s, v) => s + v.stock_qty, 0);
    const level: "out" | "low" | "ok" = stock <= 0 ? "out" : stock <= p.low_stock_threshold ? "low" : "ok";
    return { p, vars, stock, level };
  });
  const order = { out: 0, low: 1, ok: 2 };
  rows.sort((a, b) => (a.p.id === focus ? -1 : b.p.id === focus ? 1 : order[a.level] - order[b.level]));

  const outCount = rows.filter((r) => r.level === "out").length;
  const lowCount = rows.filter((r) => r.level === "low").length;
  const focusName = rows.find((r) => r.p.id === focus)?.p.name_en;

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Inventory"
        description="Add each new batch here. Orders take stock off automatically, and cancelled or refused orders put it back."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <span className="chip bg-rose px-3 py-1 text-white">{outCount} out of stock</span>
        <span className="chip bg-honey px-3 py-1 text-cocoa">{lowCount} running low</span>
        <span className="chip bg-sage/15 px-3 py-1 text-[#56633a]">{rows.length - outCount - lowCount} fine</span>
      </div>

      {!rows.length ? (
        <EmptyState title="No products yet">
          <Link href="/admin/catalog/products/new" className="underline">
            Add a product
          </Link>{" "}
          to start tracking stock.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ p, vars, stock, level }) => (
            <section
              key={p.id}
              id={p.id}
              className={`card grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:p-5 ${p.id === focus ? "ring-2 ring-plum" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Swatch color={p.color ?? p.coatings?.color} size={28} />
                <div className="grid gap-0.5">
                  <Link href={`/admin/catalog/products/${p.id}`} className="font-semibold text-plum hover:underline">
                    {p.name_en}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="num text-lg font-medium text-cocoa">{stockLabel(p.stock_unit, stock)}</span>
                    <StatusChip status={level} />
                    {p.status === "draft" && <StatusChip status="draft" />}
                  </span>
                  {p.stock_unit === "pieces" && vars.length > 1 && (
                    <span className="num text-xs text-muted">
                      {vars.map((v) => `${v.option_values?.label_en ?? v.label_en ?? "Standard"}: ${v.stock_qty}`).join(" · ")}
                    </span>
                  )}
                  <span className="text-xs text-muted">Warns at {stockLabel(p.stock_unit, p.low_stock_threshold)}</span>
                </div>
              </div>
              <StockForm
                productId={p.id}
                unit={p.stock_unit}
                variants={vars.map((v) => ({ id: v.id, label: v.option_values?.label_en ?? v.label_en ?? "Standard" }))}
              />
            </section>
          ))}
        </div>
      )}

      <Section
        className="mt-6"
        title={focusName ? `History: ${focusName}` : "Recent stock history"}
        actions={
          focus ? (
            <Link href="/admin/inventory" className="btn btn-ghost btn-sm">
              Show all products
            </Link>
          ) : undefined
        }
      >
        {!moves?.length ? (
          <p className="text-sm text-muted">No stock changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-start">
                  <th className="py-2 pe-3 text-start font-medium text-plum">When</th>
                  <th className="py-2 pe-3 text-start font-medium text-plum">Product</th>
                  <th className="py-2 pe-3 text-start font-medium text-plum">Change</th>
                  <th className="py-2 pe-3 text-start font-medium text-plum">Why</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => {
                  const unit = m.products?.stock_unit ?? "grams";
                  const size = m.variants?.option_values?.label_en ?? m.variants?.label_en;
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="num py-2.5 pe-3 whitespace-nowrap text-muted">{dateTime.format(new Date(m.created_at))}</td>
                      <td className="py-2.5 pe-3">
                        {m.products?.name_en}
                        {size && <span className="text-muted"> · {size}</span>}
                      </td>
                      <td className={`num py-2.5 pe-3 font-semibold ${m.delta > 0 ? "text-[#56633a]" : "text-[#a33a52]"}`}>
                        {m.delta > 0 ? "+" : "−"}
                        {stockLabel(unit, Math.abs(m.delta))}
                      </td>
                      <td className="py-2.5 pe-3">
                        {REASON[m.reason] ?? m.reason}
                        {m.orders?.number && <span className="text-muted"> · #{m.orders.number}</span>}
                        {m.note && <span className="text-muted"> · {m.note}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
