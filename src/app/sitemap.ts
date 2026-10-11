import type { MetadataRoute } from "next";
import { getBundles, getCatalog } from "@/store/data";
import { SITE_URL } from "@/store/meta";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, bundles] = await Promise.all([getCatalog(), getBundles()]);
  const paths = [
    "/",
    "/shop",
    "/bundles",
    "/about",
    "/contact",
    ...catalog.categories.map((c) => `/shop/${c.slug}`),
    ...catalog.products.map((p) => `/products/${p.slug}`),
    ...bundles.map((b) => `/bundles/${b.slug}`),
  ];
  return paths.map((p) => ({
    url: `${SITE_URL}${p === "/" ? "" : p}`,
    alternates: { languages: { en: `${SITE_URL}${p === "/" ? "" : p}`, ar: `${SITE_URL}/ar${p === "/" ? "" : p}` } },
  }));
}
