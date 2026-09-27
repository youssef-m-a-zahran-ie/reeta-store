import type { Metadata } from "next";
import { BundleView } from "@/store/views/pages";
import { getBundles } from "@/store/data";
import { loc } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = (await getBundles()).find((x) => x.slug === slug);
  return pageMeta({ lang: "en", path: `/bundles/${slug}`, title: b ? loc(b, "name", "en") : undefined });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <BundleView lang={"en"} slug={slug} />;
}
