import type { Metadata } from "next";
import { ProductView } from "@/store/views/pages";
import { getProduct } from "@/store/data";
import { loc } from "@/store/i18n";
import { pageMeta } from "@/store/meta";
import { mediaUrl } from "@/lib/supabase/env";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return pageMeta({
    lang: "en",
    path: `/products/${slug}`,
    title: p.seo_title || loc(p, "name", "en"),
    description: p.seo_description || loc(p, "short", "en") || undefined,
    image: mediaUrl(p.images[0]?.path),
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <ProductView lang={"en"} slug={slug} />;
}
