import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { loadCustomers } from "@/lib/admin/customers";
import { EmptyState, PageHeader, StatTile as Tile } from "@/components/admin/ui";
import { dateOnly, egp } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

const SORTS = [
  { key: "recent", label: "Latest order" },
  { key: "spend", label: "Top spenders" },
  { key: "orders", label: "Most orders" },
  { key: "flagged", label: "Flagged" },
] as const;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? "recent";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { supabase } = await requireAdmin();
  const all = await loadCustomers(supabase);

  const buyers = all.filter((c) => c.orders > 0);
  const repeat = buyers.filter((c) => c.orders > 1).length;
  const revenue = buyers.reduce((s, c) => s + c.spend, 0);

  let rows = all;
  if (q) {
    const digits = q.replace(/\D/g, "");
    const needle = q.toLowerCase();
    rows = rows.filter((c) => (digits.length >= 4 && c.phone.includes(digits.slice(-9))) || (c.name ?? "").toLowerCase().includes(needle));
  }
  if (sort === "flagged") rows = rows.filter((c) => c.flagged || c.refused_count > 0);
  rows = [...rows].sort((a, b) =>
    sort === "spend" ? b.spend - a.spend : sort === "orders" ? b.orders - a.orders : (b.last_order ?? b.created_at).localeCompare(a.last_order ?? a.created_at),
  );

  return (
    <>
      <PageHeader
        eyebrow="Run the store"
        title="Customers"
        description="Everyone who ordered, by phone number. Cancelled and refused orders don't count toward spend."
        actions={
          <>
            <Link href="/admin/orders/new" className="btn btn-secondary">
              Add an order
            </Link>
            <a href="/admin/customers/export" className="btn btn-primary" download>
              Download CSV
            </a>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Customers" value={String(buyers.length)} />
        <Tile label="Came back" value={buyers.length ? `${Math.round((repeat / buyers.length) * 100)}%` : "–"} hint={`${repeat} ordered more than once`} />
        <Tile label="Average spend" value={buyers.length ? egp(Math.round(revenue / buyers.length)) : "–"} />
        <Tile label="Flagged" value={String(all.filter((c) => c.flagged).length)} hint="Refused a delivery or marked by you" />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Sort">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/customers?sort=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={s.key === sort ? "page" : undefined}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-plum hover:bg-blush aria-[current=page]:bg-plum aria-[current=page]:text-blush"
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <form className="flex items-end gap-2" role="search">
          <input type="hidden" name="sort" value={sort} />
          <label className="field">
            <span className="sr-only">Search</span>
            <input className="input" name="q" defaultValue={q} placeholder="Name or phone" />
          </label>
          <button className="btn btn-secondary">Search</button>
        </form>
      </div>

      {!rows.length ? (
        <EmptyState title={q ? "No one matches" : "No customers yet"}>
          {q ? "Try part of the name or the last digits of the phone." : "Customers appear here after their first order."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[22px] border border-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-page text-sm">
                {["Customer", "Orders", "Spent", "Last order", "Came from", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-start font-display font-semibold text-plum">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-page/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="grid">
                      <span className="font-medium text-plum hover:underline">{c.name ?? "No name"}</span>
                      <span className="num text-sm text-muted" dir="ltr">
                        {c.phone}
                      </span>
                    </Link>
                  </td>
                  <td className="num px-4 py-3">{c.orders}</td>
                  <td className="num px-4 py-3 font-semibold">{egp(c.spend)}</td>
                  <td className="num px-4 py-3 text-sm">{c.last_order ? dateOnly.format(new Date(c.last_order)) : "–"}</td>
                  <td className="px-4 py-3 text-sm text-muted">{c.source ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {c.orders > 1 && <span className="chip bg-sage/15 text-[#56633a]">Repeat</span>}
                      {c.refused_count > 0 && <span className="chip bg-rose/12 text-[#a33a52]">Refused {c.refused_count}×</span>}
                      {c.flagged && c.refused_count === 0 && <span className="chip bg-rose/12 text-[#a33a52]">Flagged</span>}
                      {c.notes && <span className="chip bg-honey/25 text-cocoa" title={c.notes}>Note</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
