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
    lang: "ar",
    path: `/products/${slug}`,
    title: loc(p, "name", "ar"),
    description: loc(p, "short", "ar") || undefined,
    image: mediaUrl(p.images[0]?.path),
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <ProductView lang={"ar"} slug={slug} />;
}
