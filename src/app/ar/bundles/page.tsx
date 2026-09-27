import type { Metadata } from "next";
import { BundlesView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "ar", path: "/bundles", title: dict["ar"].bundles.title, description: dict["ar"].bundles.text });

export default function Page() {
  return <BundlesView lang={"ar"} />;
}
