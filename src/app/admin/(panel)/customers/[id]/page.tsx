import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, StatTile as Tile } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { STATUS_META, type OrderStatus } from "@/lib/admin/orders";
import { dateOnly, dateTime, egp } from "@/lib/format";
import { saveCustomer } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: c } = await supabase
    .from("customers")
    .select("*, orders(id, number, created_at, total, status, payment_method, address_line, source, utm_source, order_items(name_en, option_label, qty))")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const orders = [...(c.orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const kept = orders.filter((o) => o.status !== "cancelled" && o.status !== "refused");
  const spend = kept.reduce((s, o) => s + Number(o.total), 0);

  // What they buy most, by quantity.
  const fav = new Map<string, number>();
  for (const o of kept) for (const i of o.order_items ?? []) {
    const k = i.option_label ? `${i.name_en} · ${i.option_label}` : i.name_en;
    fav.set(k, (fav.get(k) ?? 0) + i.qty);
  }
  const favorites = [...fav.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const addresses = [...new Set(orders.map((o) => o.address_line))].slice(0, 3);
  const first = orders.at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title={c.name ?? "Customer"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num" dir="ltr">
              {c.phone}
            </span>
            {c.refused_count > 0 && <span className="chip bg-rose/12 text-[#a33a52]">Refused {c.refused_count}×</span>}
            {c.flagged && <span className="chip bg-rose text-white">Flagged</span>}
          </span>
        }
        actions={
          <>
            <Link href="/admin/customers" className="btn btn-ghost">
              All customers
            </Link>
            <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              WhatsApp
            </a>
            <Link href={`/admin/orders/new?customer=${c.id}`} className="btn btn-primary">
              New order for them
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Orders" value={String(kept.length)} />
        <Tile label="Spent" value={egp(spend)} />
        <Tile label="Average order" value={kept.length ? egp(Math.round(spend / kept.length)) : "–"} />
        <Tile
          label="Customer since"
          value={first ? dateOnly.format(new Date(first.created_at)) : dateOnly.format(new Date(c.created_at))}
          hint={first ? `First came from ${first.utm_source ?? (first.source === "web" ? "the site directly" : first.source)}` : undefined}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <Section title="Orders">
          {!orders.length ? (
            <p className="text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="grid gap-2">
              {orders.map((o) => {
                const s = STATUS_META[o.status as OrderStatus];
                return (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 hover:bg-page">
                      <span className="grid">
                        <span className="num font-medium text-plum">#{o.number}</span>
                        <span className="num text-xs text-muted">{dateTime.format(new Date(o.created_at))}</span>
                      </span>
                      <span className="hidden min-w-0 flex-1 truncate text-sm text-muted sm:block">
                        {(o.order_items ?? []).map((i) => `${i.qty}× ${i.name_en}${i.option_label ? ` ${i.option_label}` : ""}`).join(", ")}
                      </span>
                      <span className="num font-semibold">{egp(o.total)}</span>
                      <span className={`chip ${s.className}`}>{s.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <aside className="grid gap-4">
          <Section title="About them">
            <ActionForm action={saveCustomer} className="grid gap-3">
              <input type="hidden" name="id" value={c.id} />
              <label className="field">
                <span className="label">Name</span>
                <input className="input" name="name" defaultValue={c.name ?? ""} required />
              </label>
              <label className="field">
                <span className="label">Notes</span>
                <textarea className="input" name="notes" defaultValue={c.notes ?? ""} rows={3} placeholder="Likes extra dark, call after 5pm…" />
              </label>
              <Toggle name="flagged" defaultChecked={c.flagged} label="Flag (be careful with cash orders)" />
              <div>
                <SubmitButton className="btn btn-secondary btn-sm">Save</SubmitButton>
              </div>
            </ActionForm>
          </Section>
          {favorites.length > 0 && (
            <Section title="Buys most">
              <ul className="grid gap-1.5 text-[15px]">
                {favorites.map(([name, qty]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span>{name}</span>
                    <span className="num text-muted">×{qty}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {addresses.length > 0 && (
            <Section title="Addresses">
              <ul className="grid gap-2 text-sm">
                {addresses.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
