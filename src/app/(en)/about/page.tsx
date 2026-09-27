import type { Metadata } from "next";
import { AboutView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "en", path: "/about", title: dict["en"].about.title });

export default function Page() {
  return <AboutView lang={"en"} />;
}
