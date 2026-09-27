import type { Metadata } from "next";
import { ShopView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "en", path: "/shop", title: dict["en"].shop.title });

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView lang={"en"} category={null} searchParams={await searchParams} />;
}
