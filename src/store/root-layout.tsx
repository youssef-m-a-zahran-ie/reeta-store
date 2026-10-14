import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StoreShell } from "./components/shell";
import type { Lang } from "./i18n";
import { SITE_URL } from "./meta";

export const storeViewport: Viewport = { themeColor: "#f2d0e3", viewportFit: "cover" };

export function storeMetadata(lang: Lang): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: lang === "ar" ? "ريتا · مكسرات متغطية بالحب" : "Reeta · Nuts, coated in love", template: "%s · Reeta" },
    description:
      lang === "ar"
        ? "كاجو ولوز وبندق ومكاداميا بصوصات الشوكولاتة والبستاشيو. اطلب أونلاين والتوصيل في القاهرة والجيزة."
        : "Cashews, almonds, hazelnuts and macadamia coated in chocolate and pistachio sauces. Order online, delivered across Cairo and Giza.",
    icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
  };
}

export function StoreRootLayout({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="antialiased">
      <body className="min-h-screen">
        <StoreShell lang={lang}>{children}</StoreShell>
      </body>
    </html>
  );
}
