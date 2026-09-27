import type { Metadata } from "next";
import { BundlesView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "en", path: "/bundles", title: dict["en"].bundles.title, description: dict["en"].bundles.text });

export default function Page() {
  return <BundlesView lang={"en"} />;
}
