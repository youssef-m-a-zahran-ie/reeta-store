import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { NEXT_LABEL, NEXT_STEP, STATUS_META, type OrderStatus } from "@/lib/admin/orders";
import { dateTime, egp, margin } from "@/lib/format";
import { saveInternalNote, setOrderStatus, setPaymentStatus } from "../actions";

export const metadata: Metadata = { title: "Order" };

const EVENT_TEXT: Record<string, string> = { created: "Order placed", status: "Status changed", payment: "Payment", note: "Note", edit: "Edited" };

function wa(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

const SOURCE_LABEL: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", phone: "Phone call", other: "Added by hand" };

export default async function OrderPage({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: o }, { data: items }, { data: events }] = await Promise.all([
    supabase.from("orders").select("*, customers(id, refused_count, flagged, notes)").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (!o) notFound();

  const { count: pastOrders } = o.customer_id
    ? await supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", o.customer_id).neq("id", o.id)
    : { count: 0 };

  const status = o.status as OrderStatus;
  const meta = STATUS_META[status];
  const next = NEXT_STEP[status];
  const cost = (items ?? []).reduce((s, i) => s + (i.unit_cost ?? 0) * i.qty, 0);
  const hasCost = (items ?? []).every((i) => i.unit_cost !== null);
  const profit = o.subtotal - o.discount_total - cost;
  const address = [o.address_line, o.building && `Building ${o.building}`, o.floor && `Floor ${o.floor}`, o.apartment && `Apt ${o.apartment}`, o.landmark]
    .filter(Boolean)
    .join(", ");
  const firstName = o.customer_name.split(" ")[0];
  const confirmText =
    o.lang === "ar"
      ? `أهلًا ${firstName}، معاك ريتا 💜 بنأكد طلبك رقم ${o.number} بإجمالي ${o.total} جنيه. العنوان: ${o.address_line}. تمام كده؟`
      : `Hi ${firstName}, this is Reeta. Confirming your order #${o.number}, total ${o.total} EGP, to ${o.address_line}. All good?`;

  return (
    <>
      <PageHeader
        eyebrow={`Orders · ${dateTime.format(new Date(o.created_at))}`}
        title={`Order #${o.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className={`chip ${meta.className}`}>{meta.label}</span>
            <span className={`chip ${o.payment_status === "paid" ? "bg-sage/15 text-[#56633a]" : "bg-cocoa/10 text-cocoa/70"}`}>
              {o.payment_method === "cod" ? "Cash on delivery" : "InstaPay"} · {o.payment_status === "paid" ? "Paid" : "Not paid"}
            </span>
            {o.utm_source && <span className="chip bg-blush text-cocoa">From {o.utm_source}</span>}
            {o.source !== "web" && <span className="chip bg-blush text-cocoa">{SOURCE_LABEL[o.source] ?? o.source}</span>}
          </span>
        }
        actions={
          <>
            <Link href="/admin/orders" className="btn btn-ghost">
              All orders
            </Link>
            <Link href={`/admin/slip/${o.id}`} target="_blank" className="btn btn-secondary">
              Print slip
            </Link>
          </>
        }
      />
      {created && (
        <p role="status" className="mb-5 rounded-xl bg-sage/15 px-4 py-2.5 text-sm font-medium text-[#4d5a33]">
          Order #{o.number} added. Stock is updated.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 gap-5">
          <Section title="Next step">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {next && (
                  <ActionForm action={setOrderStatus} hideNotice={false}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value={next} />
                    <SubmitButton pending="Updating…">{NEXT_LABEL[status]}</SubmitButton>
                  </ActionForm>
                )}
                <a href={wa(o.phone, confirmText)} target="_blank" rel="noopener noreferrer" className="btn border-2 border-sage text-[#56633a] hover:bg-sage hover:text-white">
                  WhatsApp the customer
                </a>
                <a href={`tel:${o.phone}`} className="btn btn-ghost border-2 border-plum/20">
                  Call {o.phone}
                </a>
              </div>
              <details className="rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold text-plum">Set another status</summary>
                <ActionForm action={setOrderStatus} className="mt-3 grid gap-3">
                  <input type="hidden" name="id" value={o.id} />
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                      <label key={s} className="cursor-pointer">
                        <input type="radio" name="status" value={s} defaultChecked={s === status} className="peer sr-only" />
                        <span className={`chip px-3 py-1.5 opacity-60 peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-plum peer-focus-visible:ring-2 peer-focus-visible:ring-rose ${STATUS_META[s].className}`}>
                          {STATUS_META[s].label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <input className="input" name="note" placeholder="Why? (optional, e.g. customer asked to cancel)" maxLength={300} />
                  <p className="hint">Cancelled and refused orders put their stock back. Refused also flags the customer.</p>
                  <div>
                    <SubmitButton className="btn btn-secondary btn-sm">Save status</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </div>
          </Section>

          <Section title="Items">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-sm">
                    {["Item", "Qty", "Price", "Total", "Margin"].map((h) => (
                      <th key={h} className="py-2 pe-3 text-start font-medium text-plum">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((i) => {
                    const m = margin(i.unit_price, i.unit_cost);
                    return (
                      <tr key={i.id} className="border-t border-line">
                        <td className="py-2.5 pe-3">
                          {i.name_en}
                          {i.option_label && <span className="text-muted"> · {i.option_label}</span>}
                          {i.bundle_id && <span className="chip ms-2 bg-plum/10 text-plum">Bundle</span>}
                        </td>
                        <td className="num py-2.5 pe-3">{i.qty}</td>
                        <td className="num py-2.5 pe-3">{egp(i.unit_price)}</td>
                        <td className="num py-2.5 pe-3 font-semibold">{egp(i.line_total)}</td>
                        <td className="num py-2.5 pe-3 text-sm">{m === null ? <span className="text-muted">No cost</span> : `${m}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid max-w-sm gap-1.5 border-t border-line pt-3 text-[15px] sm:ms-auto">
              <Row label="Subtotal" value={egp(o.subtotal)} />
              {o.discount_total > 0 && <Row label={`Discount${o.discount_code ? ` (${o.discount_code})` : ""}`} value={`−${egp(o.discount_total)}`} />}
              <Row label={`Delivery${o.distance_km ? ` · ${o.distance_km} km` : ""}`} value={o.shipping_fee > 0 ? egp(o.shipping_fee) : "Free"} />
              <Row label="Total" value={egp(o.total)} strong />
              {hasCost && <Row label="Profit on products" value={egp(profit)} muted />}
            </dl>
          </Section>

          <Section title="Internal note" description="Only the team sees this.">
            <ActionForm action={saveInternalNote} className="grid gap-3">
              <input type="hidden" name="id" value={o.id} />
              <textarea className="input" name="internal_note" defaultValue={o.internal_note ?? ""} rows={3} maxLength={1000} />
              <div>
                <SubmitButton className="btn btn-secondary btn-sm">Save note</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-8">
          <Section title="Customer">
            <div className="grid gap-1.5 text-[15px]">
              {o.customer_id ? (
                <Link href={`/admin/customers/${o.customer_id}`} className="font-semibold text-plum hover:underline">
                  {o.customer_name}
                </Link>
              ) : (
                <p className="font-semibold text-plum">{o.customer_name}</p>
              )}
              <p className="num" dir="ltr">
                {o.phone}
              </p>
              <p className="text-sm text-muted">{pastOrders ? `${pastOrders} earlier order${pastOrders === 1 ? "" : "s"}` : "First order"}</p>
              {o.customers?.flagged && (
                <p className="rounded-xl bg-rose/12 px-3 py-2 text-sm font-semibold text-[#a33a52]">
                  Refused delivery {o.customers.refused_count} time{o.customers.refused_count === 1 ? "" : "s"} before
                </p>
              )}
            </div>
          </Section>
          <Section title="Delivery">
            <p className="text-[15px]">{address}</p>
            {o.lat && o.lng && (
              <a
                href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm mt-3"
              >
                Open in Google Maps
              </a>
            )}
            {o.customer_note && (
              <p className="mt-3 rounded-xl bg-honey/20 px-3 py-2 text-sm">
                <b>Customer note:</b> {o.customer_note}
              </p>
            )}
          </Section>
          <Section title="Payment">
            <ActionForm action={setPaymentStatus} className="grid gap-2">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="paid" value={o.payment_status === "paid" ? "0" : "1"} />
              <p className="text-sm text-muted">
                {o.payment_method === "instapay"
                  ? "Mark it paid once the InstaPay transfer shows in your account."
                  : "Cash orders are marked paid automatically when delivered."}
              </p>
              <SubmitButton className={o.payment_status === "paid" ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
                {o.payment_status === "paid" ? "Mark as not paid" : "Mark as paid"}
              </SubmitButton>
            </ActionForm>
          </Section>
          <Section title="History">
            <ol className="grid gap-2 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="grid gap-0.5 border-s-2 border-blush ps-3">
                  <span className="font-semibold text-plum">
                    {EVENT_TEXT[e.type] ?? e.type}
                    {e.to_value && e.type !== "created" && (
                      <span className="font-normal text-cocoa">
                        {" "}
                        → {STATUS_META[e.to_value as OrderStatus]?.label ?? e.to_value}
                      </span>
                    )}
                  </span>
                  {e.note && <span className="text-cocoa/80">{e.note}</span>}
                  <span className="num text-xs text-muted">{dateTime.format(new Date(e.created_at))}</span>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-line pt-2 text-lg font-medium text-plum" : ""} ${muted ? "text-sm text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
