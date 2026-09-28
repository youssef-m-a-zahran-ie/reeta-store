import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { loadVariantOptions } from "../../bundles/options";
import { ManualOrderForm } from "./manual-order-form";

export const metadata: Metadata = { title: "Add an order" };

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/.test(sp.customer) ? sp.customer : null;
  const { supabase } = await requireAdmin();

  const [variants, { data: bundles }, { data: customer }, { data: lastOrder }] = await Promise.all([
    loadVariantOptions(supabase),
    supabase.from("bundles").select("id, name_en, price").eq("status", "active").order("sort"),
    customerId ? supabase.from("customers").select("name, phone").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
    customerId
      ? supabase
          .from("orders")
          .select("address_line, building, floor, apartment, landmark, lat, lng")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Orders"
        title="Add an order"
        description="For orders that come in on WhatsApp, Instagram or the phone. Prices, discounts and stock work exactly like the website."
        actions={
          <Link href="/admin/orders" className="btn btn-ghost">
            All orders
          </Link>
        }
      />
      <ManualOrderForm
        options={{
          products: variants.filter((v) => v.active).map((v) => ({ key: `v:${v.id}`, label: v.label, price: v.price })),
          bundles: (bundles ?? []).map((b) => ({ key: `b:${b.id}`, label: b.name_en, price: b.price })),
        }}
        initial={{
          name: customer?.name ?? "",
          phone: customer?.phone ? customer.phone.replace(/^\+2/, "") : "",
          address_line: lastOrder?.address_line ?? "",
          building: lastOrder?.building ?? "",
          floor: lastOrder?.floor ?? "",
          apartment: lastOrder?.apartment ?? "",
          landmark: lastOrder?.landmark ?? "",
          location: lastOrder?.lat && lastOrder?.lng ? `${lastOrder.lat}, ${lastOrder.lng}` : "",
        }}
      />
    </>
  );
}
