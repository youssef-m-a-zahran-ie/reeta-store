import type { Metadata } from "next";
import { ShopView } from "@/store/views/pages";
import { getCatalog } from "@/store/data";
import { loc } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCatalog()).categories.find((c) => c.slug === category);
  return pageMeta({ lang: "en", path: `/shop/${category}`, title: cat ? loc(cat, "name", "en") : undefined, description: cat ? loc(cat, "description", "en") || undefined : undefined });
}

export default async function Page({ params, searchParams }: Props) {
  const { category } = await params;
  return <ShopView lang={"en"} category={category} searchParams={await searchParams} />;
}
