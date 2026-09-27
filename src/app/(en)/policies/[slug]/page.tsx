import type { Metadata } from "next";
import { PolicyView } from "@/store/views/pages";
import { getPage } from "@/store/data";
import { loc } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPage(slug);
  return pageMeta({ lang: "en", path: `/policies/${slug}`, title: p ? loc(p, "title", "en") : undefined });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <PolicyView lang={"en"} slug={slug} />;
}
