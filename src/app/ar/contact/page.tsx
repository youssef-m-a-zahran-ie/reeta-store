import type { Metadata } from "next";
import { ContactView } from "@/store/views/pages";
import { dict } from "@/store/i18n";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "ar", path: "/contact", title: dict["ar"].contact.title });

export default function Page() {
  return <ContactView lang={"ar"} />;
}
