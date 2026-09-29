import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section } from "@/components/admin/ui";
import { DeliverySettings } from "./delivery-map";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!s) return null;

  return (
    <>
      <PageHeader
        eyebrow="Run the store"
        title="Delivery"
        description="Where the store is, what delivery costs and how far you deliver. Free-delivery offers come from Discounts."
      />
      <Section
        title="Delivery pricing"
        description="The fee starts at the price per km near the store, eases off with distance, and reaches the maximum at the delivery limit. It's rounded up and never below the minimum. Past the limit, checkout says delivery isn't available there."
      >
        <DeliverySettings
          initial={{
            lat: s.store_lat,
            lng: s.store_lng,
            perKm: s.fee_per_km,
            min: s.min_shipping_fee,
            max: s.max_shipping_fee,
            maxKm: s.max_delivery_km,
            factor: s.distance_factor,
            round: s.fee_round_to,
          }}
        />
      </Section>
    </>
  );
}
