"use client";

import Link from "next/link";
import { useState } from "react";
import type { Catalog, StoreProduct } from "../data";
import { dict, href, loc, type Lang } from "../i18n";
import { ProductCard } from "./product-card";
import { EmptyOrbit } from "./orbit-decor";

type Sort = "featured" | "low" | "high" | "new";

function minPrice(p: StoreProduct) {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0;
}

export function ShopBrowser({
  catalog,
  lang,
  category,
  initial,
}: {
  catalog: Catalog;
  lang: Lang;
  category: string | null;
  initial: { flavor?: string; base?: string };
}) {
  const t = dict[lang];
  const [flavor, setFlavor] = useState(initial.flavor ?? "");
  const [base, setBase] = useState(initial.base ?? "");
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");

  const cat = catalog.categories.find((c) => c.slug === category) ?? null;
  const inCategory = catalog.products.filter((p) => !cat || p.category_id === cat.id);
  const coatings = catalog.coatings.filter((c) => inCategory.some((p) => p.coating_slug === c.slug));
  const bases = catalog.bases.filter((b) => inCategory.some((p) => p.base_slug === b.slug));

  const list = (() => {
    const out = inCategory.filter(
      (p) =>
        (!flavor || p.coating_slug === flavor) &&
        (!base || p.base_slug === base) &&
        (!stockOnly || p.variants.some((v) => v.available)),
    );
    const sorted = [...out];
    if (sort === "low") sorted.sort((a, b) => minPrice(a) - minPrice(b));
    else if (sort === "high") sorted.sort((a, b) => minPrice(b) - minPrice(a));
    else if (sort === "new") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort - b.sort);
    return sorted;
  })();

  const filtered = Boolean(flavor || base || stockOnly);
  const catName = (p: StoreProduct) => loc(catalog.categories.find((c) => c.id === p.category_id), "name", lang);

  return (
    <div className="grid gap-8">
      {catalog.categories.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t.nav.shop}>
          <Link
            href={href(lang, "/shop")}
            aria-current={!cat ? "page" : undefined}
            className="rounded-full border-2 border-plum/20 px-4 py-1.5 font-display font-semibold text-plum aria-[current=page]:border-plum aria-[current=page]:bg-plum aria-[current=page]:text-blush"
          >
            {t.shop.all}
          </Link>
          {catalog.categories.map((c) => (
            <Link
              key={c.id}
              href={href(lang, `/shop/${c.slug}`)}
              aria-current={cat?.id === c.id ? "page" : undefined}
              className="rounded-full border-2 border-plum/20 px-4 py-1.5 font-display font-semibold text-plum aria-[current=page]:border-plum aria-[current=page]:bg-plum aria-[current=page]:text-blush"
            >
              {loc(c, "name", lang)}
            </Link>
          ))}
        </nav>
      )}

      {inCategory.length > 0 && (
        <div className="grid gap-4 rounded-[28px] bg-cream/70 p-4 md:p-5">
          {coatings.length > 1 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.shop.flavor}>
              <span className="me-1 text-sm font-semibold text-plum">{t.shop.flavor}</span>
              <FilterChip pressed={!flavor} onClick={() => setFlavor("")}>
                <span className="size-6 rounded-full bg-[conic-gradient(#f5ead8_0_25%,#3a2420_0_50%,#a0673f_0_75%,#8a9a62_0)] shadow-[inset_-3px_-4px_0_rgb(0_0_0/.13)]" />
                {t.shop.all}
              </FilterChip>
              {coatings.map((c) => (
                <FilterChip key={c.slug} pressed={flavor === c.slug} onClick={() => setFlavor(flavor === c.slug ? "" : c.slug)}>
                  <span className="size-6 rounded-full shadow-[inset_-3px_-4px_0_rgb(0_0_0/.13)]" style={{ background: c.color }} />
                  {loc(c, "name", lang)}
                </FilterChip>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {bases.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.shop.base}>
                <span className="me-1 text-sm font-semibold text-plum">{t.shop.base}</span>
                {bases.map((b) => (
                  <FilterChip key={b.slug} pressed={base === b.slug} onClick={() => setBase(base === b.slug ? "" : b.slug)}>
                    {loc(b, "name", lang)}
                  </FilterChip>
                ))}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-cocoa">
              <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} className="peer sr-only" />
              <span className="relative h-6 w-11 rounded-full bg-cocoa/15 transition peer-checked:bg-plum peer-focus-visible:ring-2 peer-focus-visible:ring-rose after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5 rtl:after:right-0.5 rtl:after:left-auto rtl:peer-checked:after:-translate-x-5" />
              {t.shop.inStock}
            </label>
            <label className="ms-auto flex items-center gap-2 text-sm font-semibold text-plum">
              {t.shop.sort}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-full border border-plum/20 bg-white px-3 py-1.5 text-sm font-medium text-cocoa"
              >
                <option value="featured">{t.shop.sortFeatured}</option>
                <option value="low">{t.shop.sortPriceLow}</option>
                <option value="high">{t.shop.sortPriceHigh}</option>
                <option value="new">{t.shop.sortNew}</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-cocoa/70" aria-live="polite">
          {t.shop.count(list.length)}
        </p>
        {filtered && (
          <button
            type="button"
            className="text-sm font-semibold text-plum underline underline-offset-4"
            onClick={() => {
              setFlavor("");
              setBase("");
              setStockOnly(false);
            }}
          >
            {t.shop.clear}
          </button>
        )}
      </div>

      {list.length ? (
        <div className="reveal-group grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} lang={lang} categoryName={catName(p)} />
          ))}
        </div>
      ) : (
        <EmptyOrbit text={inCategory.length ? t.shop.none : t.shop.empty} />
      )}
    </div>
  );
}

function FilterChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border-[1.5px] border-plum/20 bg-white/60 py-1.5 ps-1.5 pe-3.5 text-[15px] font-semibold text-plum transition-colors hover:bg-white aria-pressed:border-plum aria-pressed:bg-plum aria-pressed:text-blush [&:not(:has(span))]:ps-3.5"
    >
      {children}
    </button>
  );
}
