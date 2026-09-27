import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, StatusChip, Swatch } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { stockLabel } from "@/lib/format";
import { loadLookups } from "../lookups";
import { ProductForm } from "../product-form";
import { VariantsForm, type VariantRow } from "../variants-form";
import { ImageManager } from "../image-manager";
import { deleteProduct, duplicateProduct } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/catalog/products/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: product }, lookups, { data: variants }, { data: prices }, { data: images }] = await Promise.all([
    supabase.from("products").select("*, coatings(color)").eq("id", id).maybeSingle(),
    loadLookups(supabase),
    supabase.from("variants").select("*, option_values(label_en, sort)").eq("product_id", id),
    supabase.from("variant_prices").select("*").eq("product_id", id),
    supabase.from("product_images").select("id, path, alt_en, alt_ar").eq("product_id", id).order("sort"),
  ]);
  if (!product) notFound();

  let templateItems: { option_value_id: string; price: number | null; cost: number | null }[] = [];
  if (product.price_template_id) {
    const { data } = await supabase
      .from("price_template_items")
      .select("option_value_id, price, cost")
      .eq("template_id", product.price_template_id);
    templateItems = data ?? [];
  }
  const templateName = lookups.templates.find((t) => t.id === product.price_template_id)?.name ?? null;

  const rows: VariantRow[] = (variants ?? [])
    .sort((a, b) => (a.option_values?.sort ?? a.sort) - (b.option_values?.sort ?? b.sort))
    .map((v) => {
      const t = templateItems.find((i) => i.option_value_id === v.option_value_id);
      return {
        id: v.id,
        label: v.option_values?.label_en ?? v.label_en ?? "Standard",
        custom: v.option_value_id === null,
        label_en: v.label_en,
        label_ar: v.label_ar,
        is_active: v.is_active,
        price: v.price,
        cost: v.cost,
        template_price: t?.price ?? null,
        template_cost: t?.cost ?? null,
        stock_qty: v.stock_qty,
      };
    });

  const activeMissing = (prices ?? []).filter((p) => p.price === null && rows.find((r) => r.id === p.variant_id)?.is_active).length;
  const color = product.color ?? product.coatings?.color ?? null;
  const stock =
    product.stock_unit === "grams" ? product.stock_grams : rows.filter((r) => r.is_active).reduce((s, r) => s + r.stock_qty, 0);

  const checklist = [
    { done: activeMissing === 0 && rows.some((r) => r.is_active), text: "Every size has a price" },
    { done: (images?.length ?? 0) > 0, text: "At least one photo" },
    { done: Boolean(product.ingredients_en && product.allergens_en), text: "Ingredients and allergens" },
    { done: stock > 0, text: "Stock added" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Catalog · Product"
        title={product.name_en}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Swatch color={color} size={16} />
            <StatusChip status={product.status} />
            <span dir="rtl">{product.name_ar}</span>
          </span>
        }
        actions={
          <>
            <Link href="/admin/catalog/products" className="btn btn-ghost">
              All products
            </Link>
            <ActionForm action={duplicateProduct} hideNotice>
              <input type="hidden" name="id" value={product.id} />
              <SubmitButton className="btn btn-secondary" pending="Copying…">
                Duplicate
              </SubmitButton>
            </ActionForm>
          </>
        }
      />

      {(sp.created || sp.copied) && (
        <p className="mb-5 rounded-xl bg-sage/15 px-4 py-2.5 text-sm font-medium text-[#4d5a33]">
          {sp.created ? "Product created as a draft. Now check the sizes, add photos, then make it active." : "Copy created as a draft."}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <div className="grid min-w-0 gap-5">
          <Section
            title="Sizes and prices"
            description={templateName ? `Prices come from the “${templateName}” template.` : "Set a price for each size you sell."}
          >
            <VariantsForm productId={product.id} variants={rows} stockUnit={product.stock_unit} templateName={templateName} />
          </Section>

          <Section title="Photos" description="The first photo is the main one on the store. Square photos look best.">
            <ImageManager productId={product.id} images={images ?? []} />
          </Section>

          <ProductForm product={product} lookups={lookups} />
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-8">
          <Section title="Ready to sell?">
            <ul className="grid gap-2 text-sm">
              {checklist.map((c) => (
                <li key={c.text} className="flex items-center gap-2">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${c.done ? "bg-sage text-white" : "border-[1.5px] border-plum/30 text-transparent"}`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className={c.done ? "text-cocoa" : "text-muted"}>{c.text}</span>
                  <span className="sr-only">{c.done ? "done" : "not done"}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Stock">
            <p className="num font-display text-2xl font-semibold text-plum">{stockLabel(product.stock_unit, stock)}</p>
            <p className="mt-1 text-sm text-muted">
              Warns at {stockLabel(product.stock_unit, product.low_stock_threshold)}.
            </p>
            <Link href={`/admin/inventory?product=${product.id}`} className="btn btn-secondary btn-sm mt-3">
              Add or correct stock
            </Link>
          </Section>
          <Section title="Delete">
            <p className="mb-3 text-sm text-muted">Products with orders can&apos;t be deleted. Archive them instead.</p>
            <DeleteForm action={deleteProduct} id={product.id} label="Delete product" question={`Delete ${product.name_en} and its photos?`} />
          </Section>
        </aside>
      </div>
    </>
  );
}
