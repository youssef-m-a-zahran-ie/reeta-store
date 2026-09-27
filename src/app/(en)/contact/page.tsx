import type { Metadata } from "next";
import { ContactView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "en", path: "/contact", title: dict["en"].contact.title });

export default function Page() {
  return <ContactView lang={"en"} />;
}
