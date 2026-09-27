import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { CATALOG_TABS, EmptyState, PageHeader, StatusChip, Swatch, Tabs } from "@/components/admin/ui";
import { egp, stockLabel } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/catalog/products">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const category = typeof sp.category === "string" ? sp.category : "";

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("products")
    .select(
      "id, slug, name_en, name_ar, status, color, stock_unit, stock_grams, low_stock_threshold, is_featured, category_id, categories(name_en), coatings(color, name_en), product_images(path, sort), variants(stock_qty, is_active)",
    )
    .order("sort")
    .order("name_en");
  if (status) query = query.eq("status", status as "draft" | "active" | "archived");
  else query = query.neq("status", "archived");
  if (category) query = query.eq("category_id", category);
  if (q) query = query.or(`name_en.ilike.%${q.replace(/[%,()]/g, "")}%,name_ar.ilike.%${q.replace(/[%,()]/g, "")}%`);

  const [{ data: products }, { data: categories }, { data: prices }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name_en").order("sort"),
    supabase.from("variant_prices").select("product_id, price, is_active"),
  ]);

  const priceRange = new Map<string, { min: number; max: number; missing: number }>();
  for (const p of prices ?? []) {
    if (!p.is_active || !p.product_id) continue;
    const r = priceRange.get(p.product_id) ?? { min: Infinity, max: -Infinity, missing: 0 };
    if (p.price === null) r.missing++;
    else {
      r.min = Math.min(r.min, p.price);
      r.max = Math.max(r.max, p.price);
    }
    priceRange.set(p.product_id, r);
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Everything you sell. A product goes live on the store when it's Active and every size has a price."
        actions={
          <Link href="/admin/catalog/products/new" className="btn btn-primary">
            New product
          </Link>
        }
      />
      <Tabs items={CATALOG_TABS} current="/admin/catalog/products" />

      {sp.deleted && <p className="mb-4 rounded-xl bg-sage/15 px-4 py-2 text-sm font-medium text-[#4d5a33]">Product deleted.</p>}

      <form className="mb-5 flex flex-wrap items-end gap-2" role="search">
        <label className="field min-w-52 flex-1">
          <span className="hint">Search</span>
          <input className="input" name="q" defaultValue={q} placeholder="Name in English or Arabic" />
        </label>
        <label className="field">
          <span className="hint">Status</span>
          <select className="input" name="status" defaultValue={status}>
            <option value="">Active and drafts</option>
            <option value="active">Active</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field">
          <span className="hint">Category</span>
          <select className="input" name="category" defaultValue={category}>
            <option value="">All</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary">Filter</button>
      </form>

      {!products?.length ? (
        <EmptyState
          title={q || status || category ? "No products match" : "No products yet"}
          action={
            <Link href="/admin/catalog/products/new" className="btn btn-primary btn-sm">
              New product
            </Link>
          }
        >
          {q || status || category ? "Try another search or clear the filters." : "Add your first product to start."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[22px] border border-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-page text-sm">
                <th className="px-4 py-3 text-start font-display font-semibold text-plum">Product</th>
                <th className="px-4 py-3 text-start font-display font-semibold text-plum">Category</th>
                <th className="px-4 py-3 text-start font-display font-semibold text-plum">Price</th>
                <th className="px-4 py-3 text-start font-display font-semibold text-plum">Stock</th>
                <th className="px-4 py-3 text-start font-display font-semibold text-plum">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cover = [...(p.product_images ?? [])].sort((a, b) => a.sort - b.sort)[0];
                const color = p.color ?? p.coatings?.color ?? null;
                const range = priceRange.get(p.id);
                const stock =
                  p.stock_unit === "grams"
                    ? p.stock_grams
                    : (p.variants ?? []).filter((v) => v.is_active).reduce((s, v) => s + v.stock_qty, 0);
                const level = stock <= 0 ? "out" : stock <= p.low_stock_threshold ? "low" : "ok";
                return (
                  <tr key={p.id} className="border-t border-line hover:bg-page/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/catalog/products/${p.id}`} className="flex items-center gap-3">
                        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-blush">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(cover.path)!} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="mark mark-full size-6 text-plum/50" aria-hidden="true" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 h-2.5" style={{ background: color ?? "transparent" }} />
                        </span>
                        <span className="grid">
                          <span className="font-semibold text-plum hover:underline">
                            {p.name_en} {p.is_featured && <span className="chip ms-1 bg-honey/30 text-cocoa">Bestseller</span>}
                          </span>
                          <span className="text-sm text-muted" dir="rtl">
                            {p.name_ar}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{p.categories?.name_en}</td>
                    <td className="num px-4 py-3 text-sm">
                      {!range ? (
                        <span className="text-muted">No sizes on</span>
                      ) : range.missing ? (
                        <span className="font-semibold text-[#a33a52]">{range.missing} without price</span>
                      ) : range.min === range.max ? (
                        egp(range.min)
                      ) : (
                        `${range.min}–${egp(range.max)}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="num">{stockLabel(p.stock_unit, stock)}</span>
                        {level !== "ok" && <StatusChip status={level} />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Swatch color={color} size={14} />
                        <StatusChip status={p.status} />
                      </span>
                    </td>
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
