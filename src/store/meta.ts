import type { Metadata } from "next";
import type { Lang } from "./i18n";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reeta-store.youssef-m-a-zahran.workers.dev";

/** Title, description, canonical and hreflang links for a store page. `path` is the English path. */
export function pageMeta({ lang, title, description, path, image }: { lang: Lang; title?: string; description?: string; path: string; image?: string | null }): Metadata {
  const en = path;
  const ar = path === "/" ? "/ar" : `/ar${path}`;
  return {
    title,
    description,
    alternates: { canonical: lang === "en" ? en : ar, languages: { en, ar, "x-default": en } },
    openGraph: {
      title: title ?? "Reeta",
      description,
      url: lang === "en" ? en : ar,
      siteName: "Reeta",
      locale: lang === "en" ? "en_US" : "ar_EG",
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  };
}
