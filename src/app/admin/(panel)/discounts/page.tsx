import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section } from "@/components/admin/ui";
import { DeleteForm } from "@/components/admin/delete-form";
import { dateTime, egp } from "@/lib/format";
import { nowMs } from "@/lib/clock";
import { DiscountForm } from "./discount-form";
import { deleteDiscount } from "./actions";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: discounts }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("discounts").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("id, name_en").neq("status", "archived").order("sort"),
    supabase.from("orders").select("discount_id, total, discount_total, status").not("discount_id", "is", null),
  ]);
  const productList = (products ?? []).map((p) => ({ id: p.id, name: p.name_en }));
  const now = nowMs();

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Discounts"
        description="Codes for money off or free delivery, and automatic free delivery above an order amount. Each one shows how much it has sold."
      />

      <div className="grid gap-5">
        <Section title="New discount">
          <DiscountForm products={productList} submitLabel="Create discount" />
        </Section>

        {!discounts?.length ? (
          <EmptyState title="No discounts yet">Create a code above, or an automatic free-delivery offer.</EmptyState>
        ) : (
          discounts.map((d) => {
            const used = (orders ?? []).filter((o) => o.discount_id === d.id && o.status !== "cancelled" && o.status !== "refused");
            const sales = used.reduce((s, o) => s + o.total, 0);
            const given = used.reduce((s, o) => s + o.discount_total, 0);
            const expired = d.ends_at && new Date(d.ends_at).getTime() < now;
            const upcoming = d.starts_at && new Date(d.starts_at).getTime() > now;
            const state = !d.is_active ? "Off" : expired ? "Ended" : upcoming ? "Scheduled" : d.usage_limit && d.used_count >= d.usage_limit ? "Used up" : "Live";
            const title = d.code ?? `Free delivery over ${egp(d.min_subtotal)}`;
            const what =
              d.type === "percent" ? `${d.value}% off` : d.type === "fixed" ? `${egp(d.value)} off` : "Free delivery";
            return (
              <Section
                key={d.id}
                title={title}
                description={[what, d.min_subtotal > 0 && d.code ? `orders over ${egp(d.min_subtotal)}` : null, d.product_ids?.length ? `${d.product_ids.length} products` : null, d.description]
                  .filter(Boolean)
                  .join(" · ")}
                actions={
                  <span
                    className={`chip ${state === "Live" ? "bg-sage text-white" : state === "Scheduled" ? "bg-honey text-cocoa" : "bg-cocoa/10 text-cocoa/70"}`}
                  >
                    {state}
                  </span>
                }
              >
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Orders", String(used.length)],
                    ["Sales", egp(sales)],
                    ["Given away", egp(given)],
                    ["Uses", d.usage_limit ? `${d.used_count} / ${d.usage_limit}` : String(d.used_count)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-page px-4 py-3">
                      <p className="text-xs text-muted">{k}</p>
                      <p className="num text-xl font-medium text-plum">{v}</p>
                    </div>
                  ))}
                </div>
                {(d.starts_at || d.ends_at) && (
                  <p className="mb-3 text-sm text-muted">
                    {d.starts_at && `From ${dateTime.format(new Date(d.starts_at))}`} {d.ends_at && `until ${dateTime.format(new Date(d.ends_at))}`}
                  </p>
                )}
                <details className="rounded-2xl border border-line p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-plum">Edit</summary>
                  <div className="mt-4">
                    <DiscountForm d={d} products={productList} submitLabel="Save" />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <DeleteForm action={deleteDiscount} id={d.id} question="Delete this discount? Only works if no order used it." />
                  </div>
                </details>
              </Section>
            );
          })
        )}
      </div>
    </>
  );
}
