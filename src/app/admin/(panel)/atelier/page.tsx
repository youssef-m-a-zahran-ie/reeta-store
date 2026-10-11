import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { saveAtelierSwitch } from "./actions";
import { AtelierPriceGrid, type GridBase, type GridCoating } from "./price-grid";
import { ATELIER_TABS } from "./tabs";

export const metadata: Metadata = { title: "Atelier prices" };

export default async function AtelierPricesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: sizes }, { data: bases }, { data: coatings }, { data: bp }, { data: cp }] = await Promise.all([
    supabase.from("settings").select("custom_enabled").eq("id", 1).single(),
    supabase.from("custom_sizes").select("id, name_en, is_active, sort, tier").order("sort").order("tier"),
    supabase.from("custom_bases").select("base_id, is_active, display, sort, bases(name_en)").order("sort"),
    supabase.from("custom_coatings").select("coating_id, is_active, sort, coatings(name_en, color)").order("sort"),
    supabase.from("custom_base_prices").select("*"),
    supabase.from("custom_coating_prices").select("*"),
  ]);

  const gridBases: GridBase[] = (bases ?? []).map((b) => ({
    id: b.base_id,
    name_en: b.bases?.name_en ?? "",
    is_active: b.is_active,
    display: b.display === "size" ? "size" : "weight",
    prices: Object.fromEntries((bp ?? []).filter((r) => r.base_id === b.base_id).map((r) => [r.size_id, { grams: r.grams, price: r.price, cost: r.cost }])),
  }));
  const gridCoatings: GridCoating[] = (coatings ?? []).map((c) => ({
    id: c.coating_id,
    name_en: c.coatings?.name_en ?? "",
    color: c.coatings?.color ?? "#5b4659",
    is_active: c.is_active,
    prices: Object.fromEntries((cp ?? []).filter((r) => r.coating_id === c.coating_id).map((r) => [r.size_id, { price: r.price, cost: r.cost }])),
  }));

  // What's live on the store right now.
  const liveSizes = new Set<string>();
  const liveBases = gridBases.filter((b) => b.is_active && Object.entries(b.prices).some(([z, p]) => p.price !== null && p.grams !== null && (liveSizes.add(z), true)));
  const liveCoatings = gridCoatings.filter((c) => c.is_active && Object.entries(c.prices).some(([z, p]) => p.price !== null && liveSizes.has(z)));
  const live = Boolean(settings?.custom_enabled) && liveBases.length > 0 && liveCoatings.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Atelier"
        description={
          <>
            Shoppers compose their own pouch: a nut, a coating and a size. The price is the nut&apos;s price at that size plus the coating&apos;s. Stock for nuts and
            coatings is on the{" "}
            <Link href="/admin/inventory#atelier" className="underline">
              Inventory
            </Link>{" "}
            page.
          </>
        }
        actions={
          <Link href="/customize" target="_blank" className="btn btn-secondary btn-sm">
            Open on the store
          </Link>
        }
      />
      <Tabs items={ATELIER_TABS} current="/admin/atelier" />

      <div className="grid gap-4">
        <Section>
          <ActionForm action={saveAtelierSwitch} className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Toggle name="custom_enabled" defaultChecked={settings?.custom_enabled ?? true} label="Atelier is on" />
              <span className="text-sm text-muted">
                {live
                  ? `Live on the store: ${liveBases.length} nut${liveBases.length === 1 ? "" : "s"}, ${liveCoatings.length} coating${liveCoatings.length === 1 ? "" : "s"}.`
                  : settings?.custom_enabled
                    ? "Hidden from the store until at least one nut and one coating have a price in the same size."
                    : "Hidden from the store."}
              </span>
            </div>
            <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
          </ActionForm>
        </Section>

        {!sizes?.length || !gridBases.length || !gridCoatings.length ? (
          <EmptyState title="Add nuts, coatings and sizes first">
            <Link href="/admin/atelier/options" className="underline">
              Set them up here
            </Link>
            , then come back to price them.
          </EmptyState>
        ) : (
          <Section title="Prices and weights" description="Price is what the shopper pays. Cost is what it costs you. Margins update as you type.">
            <AtelierPriceGrid sizes={sizes.map((z) => ({ id: z.id, name_en: z.name_en, is_active: z.is_active }))} bases={gridBases} coatings={gridCoatings} />
          </Section>
        )}
      </div>
    </>
  );
}
