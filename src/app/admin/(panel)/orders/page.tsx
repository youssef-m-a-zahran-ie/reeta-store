import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { STATUS_META, type OrderStatus } from "@/lib/admin/orders";
import { dateTime, egp } from "@/lib/format";

export const metadata: Metadata = { title: "Orders" };

const TABS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "open", label: "To handle", statuses: ["new", "confirmed", "preparing", "out_for_delivery"] },
  { key: "new", label: "New", statuses: ["new"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Cancelled / refused", statuses: ["cancelled", "refused"] },
  { key: "all", label: "All", statuses: null },
];

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { supabase } = await requireAdmin();

  let query = supabase
    .from("orders")
    .select("id, number, created_at, customer_name, phone, total, payment_method, payment_status, status, utm_source, source, order_items(qty)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^\d{3,6}$/.test(q)) query = query.eq("number", Number(q));
    else if (digits.length >= 6) query = query.ilike("phone", `%${digits.slice(-9)}%`);
    else query = query.ilike("customer_name", `%${q.replace(/[%,()]/g, "")}%`);
  }

  const [{ data: orders }, { data: counts }] = await Promise.all([query, supabase.from("orders").select("status")]);
  const countBy = (statuses: OrderStatus[] | null) =>
    (counts ?? []).filter((c) => !statuses || statuses.includes(c.status as OrderStatus)).length;

  return (
    <>
      <PageHeader
        eyebrow="Run the store"
        title="Orders"
        description="New orders land here and in your inbox. Confirm each one with the customer, then move it along."
        actions={
          <Link href="/admin/orders/new" className="btn btn-primary">
            Add an order
          </Link>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Order status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-plum hover:bg-blush aria-[current=page]:bg-plum aria-[current=page]:text-blush"
          >
            {t.label}
            <span className="num rounded-full bg-cocoa/10 px-1.5 text-xs">{countBy(t.statuses)}</span>
          </Link>
        ))}
      </nav>

      <form className="mb-5 flex flex-wrap items-end gap-2" role="search">
        <input type="hidden" name="tab" value={tab.key} />
        <label className="field min-w-60 flex-1">
          <span className="hint">Search</span>
          <input className="input" name="q" defaultValue={q} placeholder="Order number, phone or name" />
        </label>
        <button className="btn btn-secondary">Search</button>
      </form>

      {!orders?.length ? (
        <EmptyState title={q ? "No orders match" : "No orders here yet"}>
          {q ? "Try another number or name." : "When a customer orders, it shows up here and you get an email."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[22px] border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-page text-sm">
                {["Order", "Customer", "Items", "Total", "Payment", "Status", "From"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-display font-semibold text-plum">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS_META[o.status as OrderStatus];
                const qty = (o.order_items ?? []).reduce((n, i) => n + i.qty, 0);
                return (
                  <tr key={o.id} className={`border-t border-line hover:bg-page/60 ${o.status === "new" ? "bg-honey/[.07]" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="grid">
                        <span className="num font-display font-semibold text-plum hover:underline">#{o.number}</span>
                        <span className="num text-xs text-muted">{dateTime.format(new Date(o.created_at))}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="grid">
                        <span className="font-medium">{o.customer_name}</span>
                        <span className="num text-sm text-muted" dir="ltr">
                          {o.phone}
                        </span>
                      </span>
                    </td>
                    <td className="num px-4 py-3 text-sm">{qty}</td>
                    <td className="num px-4 py-3 font-semibold">{egp(o.total)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="grid gap-1">
                        {o.payment_method === "cod" ? "Cash" : "InstaPay"}
                        <span className={`chip w-fit ${o.payment_status === "paid" ? "bg-sage/15 text-[#56633a]" : "bg-cocoa/10 text-cocoa/70"}`}>
                          {o.payment_status === "paid" ? "Paid" : "Not paid"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${s.className}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{o.utm_source ?? (o.source === "web" ? "Direct" : o.source)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

