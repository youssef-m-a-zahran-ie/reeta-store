import type { Metadata } from "next";
import { AtelierView } from "@/store/views/atelier";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({
  lang: "ar",
  path: "/customize",
  title: dict.ar.atelier.metaTitle,
  description: dict.ar.atelier.lede,
  image: "/atelier/hazelnut-dark-drip.webp",
});

export default function Page() {
  return <AtelierView lang={"ar"} />;
}
